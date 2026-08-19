/**
 * Cache Manager - Minimizza il download delle immagini da Supabase
 * Utilizza localStorage per dati + IndexedDB per blob immagini
 */

class CacheManager {
    constructor(defaultTTL = 5 * 60 * 1000) {
        this.defaultTTL = defaultTTL;
        this.prefix = "cache_";
        this.dbName = "photoCache";
        this.storeName = "images";
        this.db = null;
        this.initDB();
    }

    /**
     * Inizializza IndexedDB per il caching dei blob
     */
    initDB() {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open(this.dbName, 1);
                
                request.onerror = () => {
                    console.warn("IndexedDB initialization failed");
                    resolve(false);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName);
                    }
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(true);
                };
            } catch (e) {
                console.warn("IndexedDB not available:", e);
                resolve(false);
            }
        });
    }

    /**
     * Memorizza un valore con TTL in localStorage
     */
    set(key, value, ttl = this.defaultTTL) {
        try {
            const entry = {
                value,
                timestamp: Date.now(),
                ttl
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(entry));
        } catch (e) {
            console.warn("Cache write failed:", e);
        }
    }

    /**
     * Recupera un valore se ancora valido
     */
    get(key) {
        try {
            const cached = localStorage.getItem(this.prefix + key);
            if (!cached) return null;

            const entry = JSON.parse(cached);
            const age = Date.now() - entry.timestamp;

            if (age > entry.ttl) {
                localStorage.removeItem(this.prefix + key);
                return null;
            }

            return entry.value;
        } catch (e) {
            return null;
        }
    }

    /**
     * Salva un blob (immagine) in IndexedDB
     */
    async setBlob(key, blob, ttl = this.defaultTTL) {
        if (!this.db) return;
        
        try {
            return new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], "readwrite");
                const store = transaction.objectStore(this.storeName);
                const entry = {
                    blob,
                    timestamp: Date.now(),
                    ttl
                };
                store.put(entry, key);
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
            });
        } catch (e) {
            console.warn("Blob cache write failed:", e);
        }
    }

    /**
     * Recupera un blob dalla cache se ancora valido
     */
    async getBlob(key) {
        if (!this.db) return null;
        
        try {
            return new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], "readonly");
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);
                
                request.onsuccess = () => {
                    const entry = request.result;
                    if (!entry) {
                        resolve(null);
                        return;
                    }

                    const age = Date.now() - entry.timestamp;
                    if (age > entry.ttl) {
                        // Invalida se scaduto
                        const deleteTransaction = this.db.transaction([this.storeName], "readwrite");
                        deleteTransaction.objectStore(this.storeName).delete(key);
                        resolve(null);
                    } else {
                        resolve(entry.blob);
                    }
                };

                request.onerror = () => resolve(null);
            });
        } catch (e) {
            console.warn("Blob cache read failed:", e);
            return null;
        }
    }

    /**
     * Invalida una chiave
     */
    invalidate(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (e) {
            console.warn("Cache invalidate failed:", e);
        }
    }

    /**
     * Scarica un'immagine e la cachea come blob
     * Restituisce un object URL che non richiede network
     */
    async cachePhotoBlob(filename, fetchFn, ttl = 24 * 60 * 60 * 1000) {
        const cacheKey = "photo_blob_" + filename;
        
        // Prova a recuperare dalla cache
        let blob = await this.getBlob(cacheKey);
        if (blob) {
            console.log("📷 Using cached image:", filename);
            return URL.createObjectURL(blob);
        }

        // Se non in cache, scarica
        console.log("⬇️ Downloading image:", filename);
        blob = await fetchFn();
        
        if (blob) {
            // Salva in cache per il futuro
            await this.setBlob(cacheKey, blob, ttl);
            return URL.createObjectURL(blob);
        }

        return null;
    }

    /**
     * Esecuzione con cache automatica
     */
    async withCache(key, fetchFn, ttl = this.defaultTTL) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const result = await fetchFn();
        if (result !== null && result !== undefined) {
            this.set(key, result, ttl);
        }

        return result;
    }
}

const cache = new CacheManager();

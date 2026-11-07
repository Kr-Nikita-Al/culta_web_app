import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getImageById } from '../services/imageService';

// Do not consume shared object URLs: cache eviction can revoke them while an
// image is still mounted. HTTP URLs use the browser cache and renew on failure.
export default function FastImage({ imageData, className, contain = false, onLoad, onError }: {
    imageData: { image_id: string; url?: string; title?: string; file_name?: string };
    className?: string; contain?: boolean; onLoad?: () => void; onError?: () => void;
}) {
    const { token } = useAuth();
    const [url, setUrl] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const generation = useRef(0);
    const retry = useRef(false);
    const pending = useRef(false);
    const renewRef = useRef<() => void>(() => {});
    useEffect(() => {
        const id = ++generation.current;
        retry.current = false; pending.current = false; setFailed(false); setLoaded(false);
        const initial = imageData.url?.startsWith('blob:') ? '' : imageData.url || '';
        setUrl(initial);
        const renew = async () => {
            if (pending.current || generation.current !== id) return;
            if (!token) { setFailed(true); return; }
            pending.current = true; retry.current = true; setLoaded(false); setFailed(false);
            try {
                const result = await getImageById(token, imageData.image_id);
                if (generation.current === id) { setUrl(result.url); setFailed(!result.url); }
            } catch {
                if (generation.current === id) setFailed(true);
            } finally { if (generation.current === id) pending.current = false; }
        };
        renewRef.current = renew;
        if (!initial) void renew();
        const requests = generation;
        return () => { requests.current++; };
    }, [imageData.image_id, imageData.url, token]);

    return <div className={`relative ${className || ''}`}>
        {!loaded && !failed && <div role="status" aria-label="Загрузка изображения" className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>}
        {failed ? <button type="button" className="w-full h-full bg-gray-100 text-gray-500 text-xs" onClick={event => {
            event.stopPropagation(); setUrl(''); renewRef.current();
        }}>Не удалось загрузить<br />Повторить</button> : url && <img key={url} src={url} alt={imageData.title || imageData.file_name || 'Изображение'}
            className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            loading={contain ? 'eager' : 'lazy'} onLoad={() => { setLoaded(true); setFailed(false); onLoad?.(); }} onError={() => {
                if (!retry.current) { setUrl(''); renewRef.current(); }
                else if (!pending.current) { setFailed(true); onError?.(); }
            }} />}
    </div>;
}

"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type CartItem = {
    id: number;
    title: string;
    cost: number;
    description: string;
    quantity: number;
    image_url?: string;
    brand?: string;
};

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, "quantity">) => void;
    removeFromCart: (id: number) => void;
    updateQuantity: (id: number, quantity: number) => void;
    clearCart: () => void;
    totalCost: number;
    itemCount: number;
}

const CartContext = createContext<CartContextType>({
    items: [],
    addToCart: () => { },
    removeFromCart: () => { },
    updateQuantity: () => { },
    clearCart: () => { },
    totalCost: 0,
    itemCount: 0
});

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('gecb_cart');
        if (saved) {
            try { setItems(JSON.parse(saved)); } catch { /* ignore */ }
        }
        setLoaded(true);
    }, []);

    useEffect(() => {
        if (loaded) localStorage.setItem('gecb_cart', JSON.stringify(items));
    }, [items, loaded]);

    const addToCart = (product: Omit<CartItem, "quantity">) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (id: number) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const updateQuantity = (id: number, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(id);
            return;
        }
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    };

    const clearCart = () => setItems([]);

    const totalCost = items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalCost, itemCount }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);

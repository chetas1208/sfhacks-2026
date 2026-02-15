"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type CartItem = {
    id: string;
    title: string;
    cost: number;
    description: string;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: any) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    totalCost: number;
    itemCount: number;
}

const CartContext = createContext<CartContextType>({
    items: [],
    addToCart: () => { },
    removeFromCart: () => { },
    clearCart: () => { },
    totalCost: 0,
    itemCount: 0
});

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [items, setItems] = useState<CartItem[]>([]);

    // Persist to local storage
    useEffect(() => {
        const saved = localStorage.getItem('cart');
        if (saved) setItems(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(items));
    }, [items]);

    const addToCart = (product: any) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const clearCart = () => setItems([]);

    const totalCost = items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, totalCost, itemCount }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);

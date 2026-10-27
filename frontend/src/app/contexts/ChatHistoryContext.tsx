"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
    createChat,
    deleteChat,
    listChats,
    renameChat,
} from "@/app/lib/mikeApi";
import type { Chat, Message } from "@/app/components/shared/types";

interface ChatHistoryContextType {
    chats: Chat[] | null;
    /** True when the last chats load FAILED (e.g. 429/5xx) — the sidebar
     * shows an error state instead of a misleading "No chats yet". */
    chatsError: boolean;
    retryLoadChats: () => void;
    hasMoreChats: boolean;
    currentChatId: string | null;
    setCurrentChatId: (chatId: string | null) => void;
    loadChats: () => Promise<void>;
    loadMoreChats: () => void;
    saveChat: (projectId?: string) => Promise<string | null>;
    renameChat: (chatId: string, title: string) => Promise<void>;
    newChatMessages: Message[] | null;
    setNewChatMessages: (messages: Message[] | null) => void;
    replaceChatId: (
        oldChatId: string,
        newChatId: string,
        title?: string,
    ) => void;
    deleteChat: (chatId: string) => Promise<void>;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(
    undefined,
);

const INITIAL_CHAT_LIMIT = 20;
const CHAT_LIMIT_INCREMENT = 10;

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [chats, setChats] = useState<Chat[] | null>(null);
    const [chatsError, setChatsError] = useState(false);
    const [retryNonce, setRetryNonce] = useState(0);
    const [chatLimit, setChatLimit] = useState(INITIAL_CHAT_LIMIT);
    const [hasMoreChats, setHasMoreChats] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [newChatMessages, setNewChatMessages] = useState<Message[] | null>(
        null,
    );

    const loadChats = useCallback(async () => {
        if (!user) {
            setChats([]);
            setHasMoreChats(false);
            return;
        }

        try {
            const data = await listChats({ limit: chatLimit + 1 });
            setChats(data.slice(0, chatLimit));
            setHasMoreChats(data.length > chatLimit);
            setChatsError(false);
        } catch {
            // QA RL-1 (26/10/2026): keep whatever was loaded before (or
            // null) and flag the failure — rendering "No chats yet" during
            // a rate-limit outage made users think their data was gone.
            setChats((prev) => prev ?? []);
            setHasMoreChats(false);
            setChatsError(true);
        }
    }, [chatLimit, user]);

    const retryLoadChats = useCallback(() => {
        setRetryNonce((n) => n + 1);
    }, []);

    useEffect(() => {
        if (!user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- upstream pattern, refactor deferred
            setChats([]);
            setChatLimit(INITIAL_CHAT_LIMIT);
            setHasMoreChats(false);
            setCurrentChatId(null);
            return;
        }

        void loadChats();
    }, [user, loadChats, retryNonce]);

    const loadMoreChats = useCallback(() => {
        setChatLimit((prev) => prev + CHAT_LIMIT_INCREMENT);
    }, []);

    const replaceChatId = useCallback(
        (oldChatId: string, newChatId: string, title?: string) => {
            if (!oldChatId || !newChatId || oldChatId === newChatId) {
                setCurrentChatId(newChatId || oldChatId || null);
                return;
            }

            setChats((prev) => {
                if (!prev) return prev;

                const nextChats = prev.map((chat) =>
                    chat.id === oldChatId
                        ? { ...chat, id: newChatId, title: title ?? chat.title }
                        : chat,
                );

                const seen = new Set<string>();
                return nextChats.filter((chat) => {
                    if (seen.has(chat.id)) return false;
                    seen.add(chat.id);
                    return true;
                });
            });
            setCurrentChatId(newChatId);
        },
        [],
    );

    const saveChat = useCallback(
        async (projectId?: string): Promise<string | null> => {
            try {
                const { id } = await createChat(
                    projectId ? { project_id: projectId } : undefined,
                );
                const now = new Date().toISOString();
                const newChat: Chat = {
                    id,
                    project_id: projectId ?? null,
                    user_id: user?.id ?? "",
                    title: null,
                    created_at: now,
                };
                setChats((prev) => [newChat, ...(prev ?? [])]);
                return id;
            } catch {
                return null;
            }
        },
        [user],
    );

    const renameChatFn = useCallback(
        async (chatId: string, title: string) => {
            setChats((prev) =>
                (prev ?? []).map((c) =>
                    c.id === chatId ? { ...c, title } : c,
                ),
            );
            try {
                await renameChat(chatId, title);
            } catch {
                void loadChats();
            }
        },
        [loadChats],
    );

    const deleteChatFn = useCallback(
        async (chatId: string) => {
            setChats((prev) => (prev ?? []).filter((c) => c.id !== chatId));
            if (currentChatId === chatId) setCurrentChatId(null);
            try {
                await deleteChat(chatId);
            } catch {
                void loadChats();
            }
        },
        [currentChatId, loadChats],
    );

    const value = useMemo(
        () => ({
            chats,
            hasMoreChats,
            currentChatId,
            setCurrentChatId,
            loadChats,
            loadMoreChats,
            saveChat,
            renameChat: renameChatFn,
            chatsError,
            retryLoadChats,
            newChatMessages,
            setNewChatMessages,
            replaceChatId,
            deleteChat: deleteChatFn,
        }),
        [
            chats,
            chatsError,
            retryLoadChats,
            hasMoreChats,
            currentChatId,
            loadChats,
            loadMoreChats,
            saveChat,
            renameChatFn,
            newChatMessages,
            replaceChatId,
            deleteChatFn,
        ],
    );

    return (
        <ChatHistoryContext.Provider value={value}>
            {children}
        </ChatHistoryContext.Provider>
    );
}

export function useChatHistoryContext() {
    const context = useContext(ChatHistoryContext);
    if (!context) {
        throw new Error(
            "useChatHistoryContext must be used within a ChatHistoryProvider",
        );
    }
    return context;
}

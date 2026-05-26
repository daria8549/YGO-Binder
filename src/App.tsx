import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import "./App.css";

type YugiohCard = {
  id: number;
  name: string;
  type: string;
  desc: string;
  card_images: {
    image_url: string;
    image_url_small: string;
  }[];
};

type BinderItem = {
  id: string;
  card: YugiohCard;
  language: string;
  condition: string;
  rarity: string;
  edition: string;
  year: string;
  price: string;
  setCode: string;
  notes: string;
};

type BinderSlot = BinderItem | null;
const cardsPerPage = 9;


function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ß", "ss")
    .replaceAll("-", " ");
}

function getLanguageFlagSrc(lang?: string) {
  if (lang === "de") return "https://flagcdn.com/w40/de.png";
  if (lang === "fr") return "https://flagcdn.com/w40/fr.png";
  if (lang === "it") return "https://flagcdn.com/w40/it.png";
  if (lang === "pt") return "https://flagcdn.com/w40/pt.png";
  if (lang === "es") return "https://flagcdn.com/w40/es.png";
  if (lang === "jp") return "https://flagcdn.com/w40/jp.png";
  if (lang === "kr") return "https://flagcdn.com/w40/kr.png";
  return "https://flagcdn.com/w40/gb.png";
}

const searchAliases: Record<string, string> = {
  "dominus sauberung": "Dominus Purge",
  "dominus säuberung": "Dominus Purge",
  "dominus impuls": "Dominus Impulse",
}

function LanguageBadge({ lang }: { lang?: string }) {
  const label = lang?.toUpperCase() || "EN";

  return (
    <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/80 px-1.5 py-1 text-[9px] font-bold text-white shadow">
      <img
        src={getLanguageFlagSrc(lang)}
        alt={label}
        className="h-3 w-5 rounded-sm object-cover"
      />
      <span>{label}</span>
    </span>
  );
}

type BinderSlotCellProps = {
  realIndex: number;
  item: BinderSlot;
  highlightedIndex: number | null;
  isReorganizing: boolean;
  isSelected: boolean;
  onOpen: (item: BinderItem, index: number) => void;
  onToggleSelect: (index: number) => void;
}

function BinderSlotCell({
  realIndex,
  item,
  highlightedIndex,
  isReorganizing,
  isSelected,
  onOpen,
  onToggleSelect,
}: BinderSlotCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `slot-${realIndex}`,
    disabled: !item,
    data: {
      index: realIndex,
    },
  });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `slot-${realIndex}`,
    data: {
      index: realIndex,
    },
  });

  function setNodeRef(node: HTMLElement | null) {
    setDraggableNodeRef(node);
    setDroppableNodeRef(node);
  }

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex aspect-[2/3] items-center justify-center rounded-xl border p-1 shadow-inner transition ${
        highlightedIndex === realIndex
          ? "border-amber-300 bg-amber-400/20 ring-4 ring-amber-300"
          : isOver
          ? "border-emerald-300 bg-emerald-400/20 ring-2 ring-emerald-300"
          : "border-slate-700 bg-slate-800/70"
      } ${isDragging ? "z-50 opacity-70" : ""}`}
    >
      {item ? (
       <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={() => {
            if (isReorganizing) {
              onToggleSelect(realIndex);
            } else {
              onOpen(item, realIndex);
            }
          }}
          className={`group relative aspect-[2.5/3.5] overflow-hidden rounded-xl border transition ${
              highlightedIndex === realIndex
              ? "border-amber-300 ring-4 ring-amber-400/60"
              : isSelected
              ? "border-amber-300 ring-4 ring-amber-400/50"
              : "border-slate-700 hover:border-slate-500"
          }`}
        >
          {isReorganizing && (
            <div className="absolute right-1 top-1 z-10 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
              #{realIndex + 1}
            </div>
          )}

          {isSelected && (
            <div className="absolute left-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-slate-950 shadow-lg">
              ✓
            </div>
          )}

          <img
            src={item.card.card_images[0]?.image_url}
            alt={item.card.name}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="relative h-full w-full rounded-xl border border-dashed border-slate-600 bg-slate-900/60 shadow-inner">
          {isReorganizing && (
            <div className="absolute right-1 top-1 z-10 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              #{realIndex + 1}
            </div>
          )}

          <div className="absolute inset-2 rounded-lg border border-slate-700/70 bg-slate-800/40" />
          <div className="absolute left-2 top-2 h-10 w-10 rounded-full bg-white/5 blur-md" />
        </div>
      )}
    </div>
  );
}

function normalizeBinderSlots(slots: BinderSlot[]) {
  if (slots.length === 0) {
    return Array(9).fill(null);
  }

  const remainder = slots.length % cardsPerPage;

  if (remainder === 0) {
    return slots;
  }

  return [
    ...slots,
    ...Array(cardsPerPage - remainder).fill(null),
  ];
}

function trimEmptyPages(slots: BinderSlot[]) {
  const normalized = normalizeBinderSlots(slots);

  let lastFilledIndex = -1;

  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i] !== null) {
      lastFilledIndex = i;
      break;
    }
  }

  if (lastFilledIndex === -1) {
    return Array(cardsPerPage).fill(null);
  }

  const neededPages = Math.ceil((lastFilledIndex + 1) / cardsPerPage);
  const neededSlots = neededPages * cardsPerPage;

  return normalized.slice(0, neededSlots);
}

function App() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("en");
  const [cards, setCards] = useState<YugiohCard[]>([]);
  const [binder, setBinder] = useState<BinderSlot[]>(() => {
  const savedBinder = localStorage.getItem("ygo-binder");

    if (!savedBinder) {
      return Array(cardsPerPage).fill(null);
    }

    try {
      const parsed = JSON.parse(savedBinder);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        return Array(cardsPerPage).fill(null);
      }

      return normalizeBinderSlots(parsed);
    } catch {
      return Array(cardsPerPage).fill(null);
    }
  });

  const [cardToRemove, setCardToRemove] = useState<{
    item: BinderItem;
    index: number;
  } | null>(null);

  const [isReorganizing, setIsReorganizing] = useState(false);
  const [selectedSlotIndexes, setSelectedSlotIndexes] = useState<number[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [moveWarning, setMoveWarning] = useState("");
  const binderSectionRef = useRef<HTMLDivElement | null>(null);
  const [searchError, setSearchError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [hasLoadedCloudBinder, setHasLoadedCloudBinder] = useState(false);
  const [activeView, setActiveView] = useState<
    "account" | "binder" | "search" | "lookup"
  >("binder");

  const totalPages = Math.max(1, Math.ceil(binder.length / cardsPerPage));
  const startIndex = currentPage * cardsPerPage;

  const [displayName, setDisplayName] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [showPasswordScreen, setShowPasswordScreen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [lookupSearch, setLookupSearch] = useState("");
  const [defaultCards, setDefaultCards] = useState<YugiohCard[]>([]);
  const [defaultCardsLoading, setDefaultCardsLoading] = useState(false);

  const ownedCards = binder.filter((item) => item !== null);
  const totalOwnedCards = ownedCards.length;
  const uniqueOwnedCards = new Set(ownedCards.map((item) => item?.card.id)).size;
  const emptySlots = binder.filter((item) => item === null).length;
  const ownedLanguages = Array.from(
    new Set(ownedCards.map((item) => item?.language).filter(Boolean))
  );
  const [avatarUrl, setAvatarUrl] = useState("");
  const defaultAvatars = [
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/1.png",
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/2.png",
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/3.png",
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/5.png",
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/6.png",
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/7.png",
    "https://snfzeddpfkagswyunplq.supabase.co/storage/v1/object/public/avatars/default/8.png",
  ];

  const [selectedCard, setSelectedCard] = useState<{
    item: BinderItem;
    index: number;
  } | null>(null);

  const displayedSearchCards = search.trim() ? cards : defaultCards;

  useEffect(() => {
    if (!session) return;
    if (!hasLoadedCloudBinder) return;

    const timeoutId = window.setTimeout(() => {
      saveBinderToCloud();
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [binder, session, hasLoadedCloudBinder]);

  useEffect(() => {
    if (!session) {
      setHasLoadedCloudBinder(false);
      return;
    }

    loadBinderFromCloud();
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("ygo-binder", JSON.stringify(normalizeBinderSlots(binder)));
  }, [binder]);

  useEffect(() => {
  const newTotalPages = Math.max(1, Math.ceil(binder.length / cardsPerPage));

  if (currentPage >= newTotalPages) {
      setCurrentPage(newTotalPages - 1);
    }
  }, [binder, currentPage]);

  useEffect(() => {
    if (!session) return;
    loadProfile();
  }, [session]);

  useEffect(() => {
    if (activeView === "search") {
      loadDefaultCards();
    }
  }, [activeView]);

  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const lookupRows = Array.from(
    binder
      .filter((item): item is BinderItem => item !== null && item.card !== undefined)
      .reduce((map, item) => {
        const cardId = item.card.id;

        const existing = map.get(cardId);

        if (existing) {
          existing.amount += 1;
          existing.copies.push(item);
        } else {
          map.set(cardId, {
            card: item.card,
            amount: 1,
            copies: [item],
          });
        }

        return map;
      }, new Map<number, { card: YugiohCard; amount: number; copies: BinderItem[] }>())
      .values()
  ).sort((a, b) => a.card.name.localeCompare(b.card.name));

  const filteredLookupRows = lookupRows.filter((row) => {
    const query = lookupSearch.toLowerCase().trim();

    if (!query) return true;

    const searchableText = [
      row.card.name,
      row.card.type,
      row.card.desc,
      ...row.copies.map((copy) => copy.language),
      ...row.copies.map((copy) => copy.condition),
      ...row.copies.map((copy) => copy.rarity),
      ...row.copies.map((copy) => copy.edition),
      ...row.copies.map((copy) => copy.year),
      ...row.copies.map((copy) => copy.price),
      ...row.copies.map((copy) => copy.setCode),
      ...row.copies.map((copy) => copy.notes),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  function uniqueValues(values: (string | undefined)[]) {
    const cleaned = values.filter(
      (value): value is string => Boolean(value && value.trim() !== "")
    );

    if (cleaned.length === 0) return "—";

    return Array.from(new Set(cleaned)).join(", ");
  }

  async function handleSignUp() {
  setAuthLoading(true);
  setAuthMessage("");

  const { error } = await supabase.auth.signUp({
    email: authEmail,
    password: authPassword,
  });

  if (error) {
    setAuthMessage(error.message);
  } else {
    setAuthMessage("Signup successful. Check your email if confirmation is required.");
  }

  setAuthLoading(false);
  }

  async function handleLogin() {
    setAuthLoading(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthMessage(error.message);
    } else {
      setAuthMessage("Logged in successfully.");
    }

    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setAuthMessage("Logged out.");
  }

  async function loadProfile() {
    if (!session) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", session.user.id)
      .single();

    if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
    }

    if (error && error.code !== "PGRST116") {
      setProfileMessage(error.message);
      return;
    }

    if (data?.display_name) {
      setDisplayName(data.display_name);
    }
  }

  async function saveProfile() {
    if (!session) return;

    setProfileMessage("");

    const { error } = await supabase.from("profiles").upsert({
      user_id: session.user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setProfileMessage(error.message);
    } else {
      setProfileMessage("Profile saved.");
    }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      setProfileMessage("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setProfileMessage("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setProfileMessage(error.message);
    } else {
      setProfileMessage("Password changed.");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordScreen(false);
    }
  }

  async function saveBinderToCloud() {
    if (!session) {
      setAuthMessage("Please log in before saving to cloud.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");
    const normalizedBinder = normalizeBinderSlots(binder);

    const rows = normalizedBinder.map((item, index) => ({
      user_id: session.user.id,
      slot_index: index,
      item,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("binder_slots")
      .upsert(rows, {
        onConflict: "user_id,slot_index",
      });

    if (error) {
      setAuthMessage(error.message);
    }

    setAuthLoading(false);
  }

  async function loadBinderFromCloud() {
    if (!session) {
      setAuthMessage("Please log in before loading from cloud.");
      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    const { data, error } = await supabase
      .from("binder_slots")
      .select("slot_index, item")
      .eq("user_id", session.user.id)
      .order("slot_index", { ascending: true });

    if (error) {
      setAuthMessage(error.message);
      setAuthLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setHasLoadedCloudBinder(true);
      setAuthMessage("No cloud binder found yet.");
      setAuthLoading(false);
      return;
    }

    const maxIndex = Math.max(...data.map((row) => row.slot_index));
    const loadedBinder: BinderSlot[] = Array(maxIndex + 1).fill(null);

    data.forEach((row) => {
      loadedBinder[row.slot_index] = row.item as BinderSlot;
    });

    setBinder(normalizeBinderSlots(loadedBinder));
    setCurrentPage(0);
    setHasLoadedCloudBinder(true);
    setAuthMessage("Binder loaded from cloud.");
    setAuthLoading(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const fromIndex = active.data.current?.index;
    const toIndex = over.data.current?.index;

    if (typeof fromIndex !== "number") return;
    if (typeof toIndex !== "number") return;
    if (fromIndex === toIndex) return;

    setBinder((prevBinder) => {
      const updatedBinder = [...prevBinder];

      const draggedItem = updatedBinder[fromIndex];
      const targetItem = updatedBinder[toIndex];

      if (!draggedItem) return prevBinder;

      updatedBinder[toIndex] = draggedItem;
      updatedBinder[fromIndex] = targetItem ?? null;

      return updatedBinder;
    });

    setHighlightedIndex(toIndex);

    setTimeout(() => {
      setHighlightedIndex(null);
    }, 1200);
  }

  function toggleSlotSelection(index: number) {
    setSelectedSlotIndexes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((slotIndex) => slotIndex !== index);
      }

      return [...prev, index];
    });
  }

  function deleteSelectedSlots() {
    setBinder((prevBinder) => {
      const updatedBinder = [...prevBinder];

      selectedSlotIndexes.forEach((index) => {
        updatedBinder[index] = null;
      });

      return trimEmptyPages(updatedBinder);
    });

    setSelectedSlotIndexes([]);
    setShowBulkDeleteConfirm(false);
  }

  function showCardInBinder(cardId: number) {
    const foundIndex = binder.findIndex((item) => item?.card.id === cardId);

    if (foundIndex === -1) return;

    const targetPage = Math.floor(foundIndex / cardsPerPage);

    setCurrentPage(targetPage);
    setHighlightedIndex(foundIndex);

    binderSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setTimeout(() => {
      setHighlightedIndex(null);
    }, 1200);
  }

  function moveSelectedToPage(targetPage: number) {
    const selectedCards = selectedSlotIndexes
      .sort((a, b) => a - b)
      .map((index) => ({
        oldIndex: index,
        item: binder[index],
      }))
      .filter(
        (entry): entry is { oldIndex: number; item: BinderItem } =>
          entry.item !== null
      );

    if (selectedCards.length === 0) {
      setMoveWarning("Select at least one card first.");
      return;
    }

    if (targetPage < 0) {
      setMoveWarning("There is no previous page.");
      return;
    }

    setBinder((prevBinder) => {
      const updatedBinder = [...prevBinder];

      const targetStartIndex = targetPage * cardsPerPage;
      const targetEndIndex = targetStartIndex + cardsPerPage;

      while (updatedBinder.length < targetEndIndex) {
        updatedBinder.push(null);
      }

      const emptyTargetSlots: number[] = [];

      for (let i = targetStartIndex; i < targetEndIndex; i++) {
        if (updatedBinder[i] === null) {
          emptyTargetSlots.push(i);
        }
      }

      if (emptyTargetSlots.length < selectedCards.length) {
        setMoveWarning("Not enough empty slots on that page.");
        return prevBinder;
      }

      selectedCards.forEach(({ oldIndex }) => {
        updatedBinder[oldIndex] = null;
      });

      selectedCards.forEach(({ item }, position) => {
        updatedBinder[emptyTargetSlots[position]] = item;
      });

      const firstMovedIndex = emptyTargetSlots[0];

      setCurrentPage(targetPage);
      setSelectedSlotIndexes([]);
      setMoveWarning("");
      setHighlightedIndex(firstMovedIndex);

      setTimeout(() => {
        setHighlightedIndex(null);
      }, 1200);

      return trimEmptyPages(normalizeBinderSlots(updatedBinder));
    });
  }

  function updateSelectedItem(field: keyof BinderItem, value: string) {
    if (!selectedCard) return;

    const updated = [...binder];
    const currentItem = updated[selectedCard.index];

    if (!currentItem) return;

    const updatedItem: BinderItem = {
      ...currentItem,
      [field]: value,
    };

    updated[selectedCard.index] = updatedItem;

    setBinder(updated);
    setSelectedCard({
      item: updatedItem,
      index: selectedCard.index,
    });

  }

  async function loadDefaultCards() {
    if (defaultCards.length > 0) return;

    setDefaultCardsLoading(true);

    try {
      const popularNames = [
        "Dark Magician",
        "Blue-Eyes White Dragon",
        "Red-Eyes Black Dragon",
        "Exodia the Forbidden One",
        "Ash Blossom & Joyous Spring",
        "Dark Magician Girl",
        "Kuriboh",
        "Monster Reborn",
        "Mirror Force",
        "Pot of Greed",
        "Raigeki",
        "Polymerization",
      ];

      const results = await Promise.all(
        popularNames.map(async (name) => {
          const response = await fetch(
            `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(
              name
            )}`
          );

          const data = await response.json();

          return data.data?.[0] ?? null;
        })
      );

      setDefaultCards(
        results.filter((card): card is YugiohCard => card !== null)
      );
    } catch (error) {
      console.error(error);
    } finally {
      setDefaultCardsLoading(false);
    }
  }

  async function searchCards() {
  if (!search.trim()) return;

  const normalizedSearch = normalizeSearch(search);
  const searchTerm = searchAliases[normalizedSearch] || search;

  setLoading(true);
  setSearchError("");

  try {
    const languageParam = language === "en" ? "" : `&language=${language}`;

    let response = await fetch(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(
        searchTerm
      )}${languageParam}`
    );

    let data = await response.json();

    // fallback: if selected language gives no result, try English/default API
    if (!data.data && language !== "en") {
      response = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(
          searchTerm
        )}`
      );

      data = await response.json();
    }

    if (!data.data) {
      setCards([]);
      setSearchError("No cards found.");
      return;
    }

    setCards(data.data || []);
  } catch (error) {
    console.error(error);
    setCards([]);
    setSearchError("An error occurred while searching for cards.");
  } finally {
    setLoading(false);
  }
  }
  const languageOptions = [
    { value: "en", label: "English", flag: "https://flagcdn.com/w40/gb.png" },
    { value: "de", label: "Deutsch", flag: "https://flagcdn.com/w40/de.png" },
    { value: "fr", label: "Français", flag: "https://flagcdn.com/w40/fr.png" },
    { value: "it", label: "Italiano", flag: "https://flagcdn.com/w40/it.png" },
    { value: "pt", label: "Português", flag: "https://flagcdn.com/w40/pt.png" },
  ];

  const selectedLanguageOption =
    languageOptions.find((option) => option.value === language) ?? languageOptions[0];

  return (
    <div className="min-h-screen bg-[#080711] text-[#f8ead2]">
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className="mb-4 rounded-xl border border-[#5b3b16] bg-[#151022] px-4 py-2 text-sm font-semibold text-[#f8ead2] hover:bg-[#241832]"
        >
          ☰ Menu
        </button>

        {isMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        <aside
          className={`fixed left-0 top-0 z-50 h-full w-64 transform border-r border-[#5b3b16] bg-[#120b1f] p-4 shadow-2xl transition-transform duration-300 ${
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <h2 className="mb-4 text-sm font-bold text-[#cdbfa8]">Menu</h2>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setActiveView("account");
                setIsMenuOpen(false);
              }}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                activeView === "account"
                  ? "bg-[#d4a017] text-[#080711]"
                  : "text-[#cdbfa8] hover:bg-[#241832] hover:text-[#f8ead2]"
              }`}
            >
              Account
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView("binder");
                setIsMenuOpen(false);
              }}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                activeView === "binder"
                  ? "bg-[#d4a017] text-[#080711]"
                  : "text-[#cdbfa8] hover:bg-[#241832] hover:text-[#f8ead2]"
              }`}
            >
              My Binder
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView("search");
                setIsMenuOpen(false);
              }}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                activeView === "search"
                  ? "bg-[#d4a017] text-[#080711]"
                  : "text-[#cdbfa8] hover:bg-[#241832] hover:text-[#f8ead2]"
              }`}
            >
              Search
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView("lookup");
                setIsMenuOpen(false);
              }}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                activeView === "lookup"
                  ? "bg-[#d4a017] text-[#080711]"
                  : "text-[#cdbfa8] hover:bg-[#241832] hover:text-[#f8ead2]"
              }`}
            >
              Card Lookup
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-6 flex justify-center">
            <img
              src="/yugioh-logo.png"
              alt="Yu-Gi-Oh! logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          
          {activeView === "account" && (
            <div className="mb-6 rounded-2xl border border-[#5b3b16] bg-[#120b1f] p-4">
              <h2 className="mb-3 text-lg font-bold text-[#f8ead2]">Account</h2>

              {session ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-[#5b3b16] bg-[#120b1f] p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#d4a017] bg-[#241832]">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Profile avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">👤</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#cdbfa8]">Logged in as</p>
                        <p className="truncate font-semibold text-[#f8ead2]">
                          {session.user.email}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-xl bg-[#8b1e2d] px-4 py-2 text-sm font-semibold text-[#f8ead2] hover:bg-[#b42a3d]"
                      >
                        Logout
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter display name"
                        className="rounded-xl border border-[#5b3b16] bg-[#080711] px-3 py-2 text-sm text-[#f8ead2] outline-none focus:border-[#d4a017]"
                      />

                      <button
                        type="button"
                        onClick={saveProfile}
                        className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-bold text-[#080711] hover:bg-[#f0c64a]"
                      >
                        Save profile
                      </button>

                      <div className="mt-5">
                        <p className="mb-3 text-sm font-semibold text-[#cdbfa8]">
                          Choose avatar
                        </p>


                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                          {defaultAvatars.map((avatar) => (
                            <button
                              key={avatar}
                              type="button"
                              onClick={() => setAvatarUrl(avatar)}
                              className={`overflow-hidden rounded-2xl border p-1 transition ${
                                avatarUrl === avatar
                                  ? "border-[#d4a017] bg-[#d4a017]/20"
                                  : "border-[#5b3b16] bg-[#080711] hover:border-[#d4a017]"
                              }`}
                            >
                              <img
                                src={avatar}
                                alt="Default avatar"
                                className="aspect-square w-full rounded-xl object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-4">
                      <p className="text-sm text-[#cdbfa8]">Total cards</p>
                      <p className="mt-1 text-2xl font-bold text-[#d4a017]">
                        {totalOwnedCards}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-4">
                      <p className="text-sm text-[#cdbfa8]">Unique cards</p>
                      <p className="mt-1 text-2xl font-bold text-[#d4a017]">
                        {uniqueOwnedCards}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-4">
                      <p className="text-sm text-[#cdbfa8]">Binder pages</p>
                      <p className="mt-1 text-2xl font-bold text-[#d4a017]">
                        {totalPages}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-4">
                      <p className="text-sm text-[#cdbfa8]">Empty slots</p>
                      <p className="mt-1 text-2xl font-bold text-[#d4a017]">
                        {emptySlots}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-4">
                    <h3 className="font-bold text-[#f8ead2]">Collection details</h3>

                    <p className="mt-2 text-sm text-[#cdbfa8]">
                      Languages:{" "}
                      <span className="font-semibold text-[#f8ead2]">
                        {ownedLanguages.length > 0 ? ownedLanguages.join(", ") : "None yet"}
                      </span>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#f8ead2]">Security</h3>

                      <button
                        type="button"
                        onClick={() => setShowPasswordScreen((prev) => !prev)}
                        className="rounded-xl bg-[#241832] px-4 py-2 text-sm font-semibold text-[#f8ead2] hover:bg-[#322145]"
                      >
                        Change password
                      </button>
                    </div>

                    {showPasswordScreen && (
                      <div className="mt-4 grid gap-3">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="rounded-xl border border-[#5b3b16] bg-[#080711] px-3 py-2 text-sm text-[#f8ead2] outline-none focus:border-[#d4a017]"
                        />

                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Repeat new password"
                          className="rounded-xl border border-[#5b3b16] bg-[#080711] px-3 py-2 text-sm text-[#f8ead2] outline-none focus:border-[#d4a017]"
                        />

                        <button
                          type="button"
                          onClick={changePassword}
                          className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-bold text-[#080711] hover:bg-[#f0c64a]"
                        >
                          Save new password
                        </button>
                      </div>
                    )}
                  </div>

                  {profileMessage && (
                    <p className="text-sm text-[#cdbfa8]">{profileMessage}</p>
                  )}
                </div>
              ) : (

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <input
                    type="email"
                    placeholder="Email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="rounded-xl border border-[#5b3b16] bg-[#151022] px-3 py-2 text-sm text-[#f8ead2] outline-none"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="rounded-xl border border-[#5b3b16] bg-[#151022] px-3 py-2 text-sm text-[#f8ead2] outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={authLoading}
                    className="rounded-xl bg-[#d4a017] px-4 py-2 text-sm font-semibold text-[#080711] hover:bg-[#e6b82d] disabled:opacity-50"
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={authLoading}
                    className="rounded-xl bg-[#10b981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#059669] disabled:opacity-50"
                  >
                    Sign up
                  </button>
                </div>
              )}

              {authMessage && (
                <p className="mt-3 text-sm text-[#cdbfa8]">{authMessage}</p>
              )}
            </div>
          )}

          {activeView === "search" && (
            <div className="mt-8">
              <div className="mb-5 rounded-2xl border border-[#5b3b16] bg-[#151022] p-5 shadow-lg">
                <h2 className="text-xl font-bold text-[#f8ead2]">
                  Open Card Database
                </h2>

                <p className="mt-1 text-sm text-[#cdbfa8]">
                  Search the Yu-Gi-Oh database and add cards to your binder.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    searchCards();
                  }}
                  className="mt-5 flex gap-3"
                >
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search card name..."
                    className="min-w-0 flex-1 rounded-xl bg-[#080711] px-4 py-3 text-[#f8ead2] outline-none ring-1 ring-[#5b3b16] placeholder:text-[#8f806c] focus:ring-[#d4a017]"
                  />

                  <div className="flex w-[150px] items-center gap-2 rounded-xl bg-[#080711] px-3 py-3 ring-1 ring-[#5b3b16] focus-within:ring-[#d4a017]">
                    <img
                      src={selectedLanguageOption.flag}
                      alt={selectedLanguageOption.label}
                      className="h-4 w-6 rounded-sm object-cover"
                    />

                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="min-w-0 flex-1 bg-[#080711] text-sm text-[#f8ead2] outline-none"
                    >
                      {languageOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          className="bg-[#080711] text-[#f8ead2]"
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-[#d4a017] px-5 py-3 text-sm font-bold text-[#080711] hover:bg-[#f0c64a] disabled:opacity-60"
                  >
                    {loading ? "..." : "Search"}
                  </button>
                </form>

                {searchError && (
                  <p className="mt-3 text-sm text-red-300">{searchError}</p>
                )}
              </div>

              {displayedSearchCards.length > 0 && (
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#f8ead2]">
                    {search.trim() ? "Search Results" : "Popular Cards"}
                  </h3>

                  <span className="text-sm text-[#cdbfa8]">
                    {displayedSearchCards.length} cards
                  </span>
                </div>
              )}

              <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-[#5b3b16] bg-[#120b1f] p-4">
                {defaultCardsLoading && !search.trim() && (
                  <div className="p-6 text-center text-[#cdbfa8]">
                    Loading popular cards...
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {displayedSearchCards.map((card) => {
                    const binderCount = binder.filter(
                      (item) => item?.card.id === card.id
                    ).length;

                    return (
                      <div
                        key={card.id}
                        className="group overflow-hidden rounded-2xl border border-[#5b3b16] bg-[#151022] shadow-lg transition hover:-translate-y-1 hover:border-[#d4a017]"
                      >
                        <div className="relative bg-black/30 p-2">
                          <img
                            src={card.card_images[0]?.image_url}
                            alt={card.name}
                            className="aspect-[2.5/3.5] w-full rounded-xl object-cover"
                          />

                          {binderCount > 0 && (
                            <div className="absolute right-3 top-3 rounded-full bg-[#d4a017] px-2 py-1 text-xs font-black text-[#080711] shadow">
                              x{binderCount}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 p-3">
                          <h2 className="min-h-[40px] text-sm font-bold leading-tight text-[#f8ead2]">
                            {card.name}
                          </h2>

                          <p className="truncate text-xs text-[#cdbfa8]">
                            {card.type}
                          </p>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newItem: BinderItem = {
                                  id: crypto.randomUUID(),
                                  card,
                                  language,
                                  condition: "Near Mint",
                                  rarity: "",
                                  edition: "",
                                  year: "",
                                  price: "",
                                  setCode: "",
                                  notes: "",
                                };

                                setBinder((prevBinder) => {
                                  const firstEmptyIndex = prevBinder.findIndex(
                                    (slot) => slot === null
                                  );

                                  if (firstEmptyIndex === -1) {
                                    return normalizeBinderSlots([...prevBinder, newItem]);
                                  }

                                  const updatedBinder = [...prevBinder];
                                  updatedBinder[firstEmptyIndex] = newItem;

                                  return normalizeBinderSlots(updatedBinder);
                                });
                              }}
                              className="flex-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                            >
                              {binderCount > 0 ? "Add copy" : "Add"}
                            </button>

                            {binderCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveView("binder");
                                  setTimeout(() => showCardInBinder(card.id), 50);
                                }}
                                className="rounded-lg bg-[#d4a017] px-3 py-2 text-xs font-bold text-[#080711] hover:bg-[#f0c64a]"
                              >
                                Show
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!loading && search.trim() && cards.length === 0 && (
                  <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-6 text-center text-[#cdbfa8]">
                    No cards found. Try another search term.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === "binder" && (
            <div ref={binderSectionRef} className="mt-8">
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                <h2 className="text-xl font-bold text-[#f8ead2]">My Binder</h2>

                <div className="flex justify-center">
                  <span className="text-sm font-semibold text-[#cdbfa8]">
                    Page {currentPage + 1} / {totalPages}
                  </span>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={saveBinderToCloud}
                    disabled={!session || authLoading}
                    className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={loadBinderFromCloud}
                    disabled={!session || authLoading}
                    className="text-sm font-semibold text-blue-400 transition hover:text-blue-300 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    Load
                  </button>

                  <button
                    onClick={() => {
                      setIsReorganizing((prev) => !prev);
                      setSelectedSlotIndexes([]);
                      setMoveWarning("");
                    }}
                    className={`text-sm font-semibold transition ${
                      isReorganizing
                        ? "text-amber-300 hover:text-amber-200"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isReorganizing ? "Done" : "Reorganize"}
                  </button>
                </div>
              </div>


              {isReorganizing && (
                <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-300">
                        {selectedSlotIndexes.length} selected
                      </span>

                      {selectedSlotIndexes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlotIndexes([]);
                            setMoveWarning("");
                          }}
                          className="text-xs font-semibold text-slate-400 transition hover:text-white"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={selectedSlotIndexes.length === 0}
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      className="text-sm font-semibold text-red-400 transition hover:text-red-300 disabled:cursor-not-allowed disabled:text-slate-600"
                    >
                      Delete selected
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={selectedSlotIndexes.length === 0 || currentPage === 0}
                      onClick={() => moveSelectedToPage(currentPage - 1)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Move to previous page
                    </button>

                    <button
                      type="button"
                      disabled={selectedSlotIndexes.length === 0}
                      onClick={() => moveSelectedToPage(currentPage + 1)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Move to next page →
                    </button>
                  </div>

                  {moveWarning && (
                    <p className="mt-3 text-sm font-medium text-amber-300">
                      {moveWarning}
                    </p>
                  )}
                </div>
              )}

              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-[#5b3b16] bg-gradient-to-b from-[#151022] to-[#080711] p-3 shadow-2xl">
                  {Array.from({ length: cardsPerPage }).map((_, index) => {
                    const realIndex = startIndex + index;
                    const item = binder[realIndex] ?? null;

                    return (
                      <BinderSlotCell
                        key={realIndex}
                        realIndex={realIndex}
                        item={item}
                        highlightedIndex={highlightedIndex}
                        isReorganizing={isReorganizing}
                        isSelected={selectedSlotIndexes.includes(realIndex)}
                        onToggleSelect={toggleSlotSelection}
                        onOpen={(openedItem, openedIndex) =>
                          setSelectedCard({
                            item: openedItem,
                            index: openedIndex,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </DndContext>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="flex-1 rounded-xl bg-[#241832] px-4 py-3 font-semibold text-[#f8ead2] hover:bg-[#322145] disabled:opacity-40"
                >
                  Previous
                </button>
                  
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages - 1, currentPage + 1))
                  }
                  disabled={currentPage === totalPages - 1}
                      className="flex-1 rounded-xl bg-[#241832] px-4 py-3 font-semibold text-[#f8ead2] hover:bg-[#322145] disabled:opacity-40"
                >
                  Next
                </button>

                
              </div>
            </div>
          )}

          {activeView === "lookup" && (
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
               
                <div className="mb-4 flex w-full gap-3">
                  <input
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    placeholder="Search owned cards, language, rarity, set code..."
                    className="w-[80%] rounded-xl border border-[#5b3b16] bg-[#151022] px-4 py-3 text-sm text-[#f8ead2] outline-none placeholder:text-[#8f806c] focus:border-[#d4a017]"
                  />

                  <div className="flex w-[20%] items-center justify-center whitespace-nowrap rounded-xl border border-[#5b3b16] bg-[#151022] px-4 py-3 text-sm font-bold text-[#d4a017]">
                    {lookupRows.length} unique
                  </div>
                </div>
              </div>

              {lookupRows.length === 0 ? (
                <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-6 text-center text-[#cdbfa8]">
                  Your binder is empty.
                </div>
              ) : filteredLookupRows.length === 0 ? (
                <div className="rounded-2xl border border-[#5b3b16] bg-[#151022] p-6 text-center text-[#cdbfa8]">
                  No cards match your search.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#5b3b16] bg-[#151022]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-[#241832] text-xs uppercase tracking-wide text-[#d4a017]">
                        <tr>
                          <th className="px-4 py-3">Card</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Languages</th>
                          <th className="px-4 py-3">Conditions</th>
                          <th className="px-4 py-3">Rarities</th>
                          <th className="px-4 py-3">Editions</th>
                          <th className="px-4 py-3">Set Codes</th>
                          <th className="px-4 py-3">Prices</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#5b3b16]/60">
                        {filteredLookupRows.map((row) => (
                          <tr key={row.card.id} className="hover:bg-[#241832]/60">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={row.card.card_images[0]?.image_url_small}
                                  alt={row.card.name}
                                  className="w-12 rounded-md"
                                />

                                <div>
                                  <p className="font-bold text-[#f8ead2]">
                                    {row.card.name}
                                  </p>
                                  <p className="text-xs text-[#cdbfa8]">
                                    {row.card.type}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 font-black text-[#d4a017]">
                              {row.amount}
                            </td>

                            <td className="px-4 py-3 text-[#cdbfa8]">
                              {uniqueValues(row.copies.map((copy) => copy.language))}
                            </td>

                            <td className="px-4 py-3 text-[#cdbfa8]">
                              {uniqueValues(row.copies.map((copy) => copy.condition))}
                            </td>

                            <td className="px-4 py-3 text-[#cdbfa8]">
                              {uniqueValues(row.copies.map((copy) => copy.rarity))}
                            </td>

                            <td className="px-4 py-3 text-[#cdbfa8]">
                              {uniqueValues(row.copies.map((copy) => copy.edition))}
                            </td>

                            <td className="px-4 py-3 text-[#cdbfa8]">
                              {uniqueValues(row.copies.map((copy) => copy.setCode))}
                            </td>

                            <td className="px-4 py-3 text-[#cdbfa8]">
                              {uniqueValues(row.copies.map((copy) => copy.price))}
                            </td>

                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveView("binder");
                                  setTimeout(() => showCardInBinder(row.card.id), 50);
                                }}
                                className="rounded-lg bg-[#d4a017] px-3 py-2 text-xs font-bold text-[#080711] hover:bg-[#f0c64a]"
                              >
                                Show
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
        
        
        {selectedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-900 p-5 shadow-2xl">
              <button
                onClick={() => setSelectedCard(null)}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                aria-label="Close card details"
              >
                ×
              </button>

              <div className="relative mx-auto w-48 sm:w-56">
                <img
                  src={selectedCard.item.card.card_images[0].image_url_small}
                  alt={selectedCard.item.card.name}
                  className="w-full rounded-xl object-contain"
                />

                <LanguageBadge lang={selectedCard.item.language} />
              </div>

              <h2 className="mt-4 text-2xl font-bold">
                {selectedCard.item.card.name}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {selectedCard.item.card.type}
              </p>

              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Owned Copy Details
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Personal information about this exact physical card.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-slate-400">Language</span>
                  <select
                    value={selectedCard.item.language}
                    onChange={(e) => updateSelectedItem("language", e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  >
                    <option value="en">English</option>
                    <option value="de">German</option>
                    <option value="fr">French</option>
                    <option value="it">Italian</option>
                    <option value="pt">Portuguese</option>
                    <option value="es">Spanish</option>
                    <option value="jp">Japanese</option>
                    <option value="kr">Korean</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className="text-slate-400">Condition</span>
                  <select
                    value={selectedCard.item.condition}
                    onChange={(e) => updateSelectedItem("condition", e.target.value)}
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  >
                    <option>Near Mint</option>
                    <option>Light Played</option>
                    <option>Played</option>
                    <option>Heavily Played</option>
                    <option>Damaged</option>
                  </select>
                </label>

                <label className="text-sm">
                  <span className="text-slate-400">Rarity</span>
                  <input
                    value={selectedCard.item.rarity}
                    onChange={(e) => updateSelectedItem("rarity", e.target.value)}
                    placeholder="Ultra Rare"
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm">
                  <span className="text-slate-400">Edition</span>
                  <input
                    value={selectedCard.item.edition}
                    onChange={(e) => updateSelectedItem("edition", e.target.value)}
                    placeholder="1st Edition"
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm">
                  <span className="text-slate-400">Year</span>
                  <input
                    value={selectedCard.item.year}
                    onChange={(e) => updateSelectedItem("year", e.target.value)}
                    placeholder="2020"
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm">
                  <span className="text-slate-400">Price</span>
                  <input
                    value={selectedCard.item.price}
                    onChange={(e) => updateSelectedItem("price", e.target.value)}
                    placeholder="€12"
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm">
                  <span className="text-slate-400">Set Code</span>
                  <input
                    value={selectedCard.item.setCode}
                    onChange={(e) => updateSelectedItem("setCode", e.target.value)}
                    placeholder="LOB-005"
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                  />
                </label>
              </div>

              <label className="mt-3 block text-sm">
                <span className="text-slate-400">Notes</span>
                <textarea
                  value={selectedCard.item.notes}
                  onChange={(e) => updateSelectedItem("notes", e.target.value)}
                  placeholder="Gift card, favorite artwork, damaged corner..."
                  className="mt-1 min-h-24 w-full rounded-lg bg-slate-800 px-3 py-2 text-white"
                />
              </label>

              <p className="mt-5 text-sm leading-6 text-slate-300">
                {selectedCard.item.card.desc}
              </p>

              <div className="mt-5">
              <button
                  onClick={() => {
                    setCardToRemove({
                      item: selectedCard.item,
                      index: selectedCard.index,
                    });
                  }}
                  className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500"
                >
                  Remove from Binder
                </button>
              </div>
            </div>
          </div>
        )}

        {cardToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-white">Remove card?</h2>

              <p className="mt-2 text-sm text-slate-300">
                Are you sure you want to remove{" "}
                <span className="font-semibold text-amber-300">
                  {cardToRemove.item.card.name}
                </span>{" "}
                from your binder?
              </p>

              <p className="mt-2 text-xs text-slate-500">
                This will also delete the personal details saved for this copy.
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setCardToRemove(null)}
                  className="flex-1 rounded-xl bg-slate-700 px-4 py-3 font-semibold text-white hover:bg-slate-600"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    setBinder((prevBinder) => {
                      const updatedBinder = [...prevBinder];
                      updatedBinder[cardToRemove.index] = null;
                      return trimEmptyPages(updatedBinder);
                    });

                    setCardToRemove(null);
                    setSelectedCard(null);
                  }}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
              <h3 className="text-lg font-bold text-white">
                Delete selected cards?
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                This will remove {selectedSlotIndexes.length} selected card
                {selectedSlotIndexes.length === 1 ? "" : "s"} from your binder.
                Empty slots will stay in place.
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={deleteSelectedSlots}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      
    </div>
  );
}

export default App;
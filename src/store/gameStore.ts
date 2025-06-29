import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  GameState,
  User,
  Pet,
  Item,
  Notification,
  Achievement,
  Collectible,
  Quest,
  RedeemCode,
} from "../types/game";
import { gameService } from "../services/gameService";
import { storeService } from "../services/storeService";
import { playNotificationSound } from "../utils/soundManager";

// Store interfaces
export interface Store {
  id: string;
  name: string;
  description: string;
  type: "general" | "equipment" | "food" | "potions" | "premium" | "seasonal";
  npcName: string;
  npcImage: string;
  npcDialogue: string;
  isOpen: boolean;
  openHours: { start: number; end: number };
  inventory: StoreItem[];
  specialOffers: SpecialOffer[];
  reputation: number;
  discountLevel: number;
}

export interface StoreItem {
  id: string;
  itemSlug: string;
  basePrice: number;
  currentPrice: number;
  currency: "xenocoins" | "cash";
  stock: number;
  isOnSale: boolean;
  saleDiscount: number;
  isLimited: boolean;
  requirements: Requirement[];
}

export interface SpecialOffer {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  currency: "xenocoins" | "cash";
  expiresAt: Date;
}

export interface Requirement {
  type: "level" | "achievement" | "item" | "currency";
  value: any;
  description: string;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  totalCost: number;
  currency: "xenocoins" | "cash";
  newBalance: number;
}

// Ship position interface
export interface ShipPosition {
  x: number;
  y: number;
}

interface GameStore extends GameState {
  // Ship position state
  shipPosition: ShipPosition;
  setShipPosition: (position: ShipPosition) => void;

  // Egg hatching state
  selectedEggForHatching: any;
  isHatchingInProgress: boolean;
  hatchingEgg: any;
  setSelectedEggForHatching: (egg: any) => void;
  clearSelectedEggForHatching: () => void;
  setIsHatchingInProgress: (inProgress: boolean) => void;
  setHatchingEgg: (egg: any) => void;
  clearHatchingEgg: () => void;
  getHatchingTimeRemaining: () => number;

  // User management
  setUser: (user: User | null) => void;
  updateUser: (userData: Partial<User>) => void;
  initializeNewUser: (user: User) => void;

  // Pet management
  setActivePet: (pet: Pet | null) => void;
  addPet: (pet: Pet) => void;
  updatePet: (petId: string, updates: Partial<Pet>) => void;
  createPet: (petData: Omit<Pet, "id" | "createdAt" | "updatedAt">) => Promise<Pet | null>;

  // Currency management
  updateCurrency: (type: "xenocoins" | "cash", amount: number) => Promise<boolean>;
  setCurrency: (xenocoins: number, cash: number) => void;

  // Inventory management
  addToInventory: (item: Item, quantity?: number) => Promise<boolean>;
  removeFromInventory: (inventoryItemId: string, quantity?: number) => Promise<boolean>;
  useItem: (inventoryItemId: string, petId: string) => Promise<boolean>;

  // Notification management
  addNotification: (notification: Omit<Notification, "id" | "createdAt">) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearNotifications: () => void;

  // Screen navigation
  setCurrentScreen: (screen: string) => void;

  // Store management
  getAllStores: () => Store[];
  getStoresByType: (type: string) => Store[];
  purchaseStoreItem: (storeId: string, itemId: string, quantity: number) => Promise<PurchaseResult>;
  getUniversalItem: (slug: string) => Promise<Item | null>;
  restockStore: (storeId: string) => Promise<boolean>;

  // Achievement management
  checkAchievements: () => void;
  unlockAchievement: (achievementId: string) => void;

  // Collectible management
  getAllCollectibles: () => Collectible[];
  getCollectiblesByType: (type: "egg" | "fish" | "gem" | "stamp" | "stone" | "artwork") => Collectible[];
  getCollectedCollectibles: () => Collectible[];
  getTotalCollectiblePoints: () => number;
  collectItem: (collectibleName: string) => Promise<boolean>;

  // Daily check-in
  dailyCheckin: () => void;
  canClaimDailyCheckin: () => boolean;
  getDailyCheckinStreak: () => number;
  canClaimWeeklyReward: () => boolean;
  claimWeeklyReward: () => void;

  // Redeem codes
  getAllRedeemCodes: () => RedeemCode[];
  getActiveRedeemCodes: () => RedeemCode[];
  createRedeemCode: (codeData: Omit<RedeemCode, "id" | "createdAt" | "currentUses" | "usedBy">) => void;
  updateRedeemCode: (codeId: string, updates: Partial<RedeemCode>) => void;
  deleteRedeemCode: (codeId: string) => void;
  redeemCode: (code: string) => Promise<{ success: boolean; message: string }>;

  // Player search and profiles
  searchPlayers: (query: string) => Promise<User[]>;
  getPlayerProfile: (userId: string) => Promise<User | null>;
  setViewedUserId: (userId: string | null) => void;

  // Data loading and real-time updates
  loadUserData: (userId: string) => Promise<void>;
  loadUserAchievements: (userId: string) => Promise<void>;
  loadUserCollectibles: (userId: string) => Promise<void>;
  subscribeToRealtimeUpdates: () => void;
  unsubscribeFromRealtimeUpdates: () => void;

  // Internal state
  subscriptionId: string | null;
}

// Helper function to convert date strings back to Date objects
const rehydrateDates = (obj: any): any => {
  if (!obj) return obj;

  if (typeof obj === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
    return new Date(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(rehydrateDates);
  }

  if (typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "createdAt" || key === "lastLogin" || key === "updatedAt" || key === "hatchTime" || key === "lastInteraction" || key === "deathDate" || key === "unlockedAt" || key === "collectedAt" || key === "expiresAt") {
        result[key] = typeof value === "string" ? new Date(value) : value;
      } else {
        result[key] = rehydrateDates(value);
      }
    }
    return result;
  }

  return obj;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      activePet: null,
      pets: [],
      inventory: [],
      xenocoins: 0,
      cash: 0,
      notifications: [],
      language: "pt-BR",
      currentScreen: "pet",
      achievements: [],
      collectibles: [],
      quests: [],
      redeemCodes: [],
      viewedUserId: null,
      subscriptionId: null,

      // Ship position state (default to center)
      shipPosition: { x: 0, y: 0 },
      setShipPosition: (position: ShipPosition) => {
        set({ shipPosition: position });
      },

      // Egg hatching state
      selectedEggForHatching: null,
      isHatchingInProgress: false,
      hatchingEgg: null,
      setSelectedEggForHatching: (egg: any) => set({ selectedEggForHatching: egg }),
      clearSelectedEggForHatching: () => set({ selectedEggForHatching: null }),
      setIsHatchingInProgress: (inProgress: boolean) => set({ isHatchingInProgress: inProgress }),
      setHatchingEgg: (egg: any) => {
        const hatchingStartTime = Date.now();
        set({ 
          hatchingEgg: { ...egg, hatchingStartTime },
        });
      },
      clearHatchingEgg: () => set({ hatchingEgg: null }),
      getHatchingTimeRemaining: () => {
        const state = get();
        if (!state.hatchingEgg?.hatchingStartTime) return 0;
        
        const hatchingDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
        const elapsed = Date.now() - state.hatchingEgg.hatchingStartTime;
        return Math.max(0, hatchingDuration - elapsed);
      },

      // User management
      setUser: (user: User | null) => set({ user }),
      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },
      initializeNewUser: (user: User) => {
        set({
          user,
          activePet: null,
          pets: [],
          inventory: [],
          xenocoins: 0,
          cash: 0,
          notifications: [],
          achievements: [],
          collectibles: [],
          quests: [],
          redeemCodes: [],
          shipPosition: { x: 0, y: 0 }, // Reset ship position for new user
        });
      },

      // Pet management
      setActivePet: (pet: Pet | null) => set({ activePet: pet }),
      addPet: (pet: Pet) => {
        const pets = get().pets;
        const updatedPets = [...pets, pet];
        set({ pets: updatedPets, activePet: pet });
      },
      updatePet: (petId: string, updates: Partial<Pet>) => {
        const { pets, activePet } = get();
        const updatedPets = pets.map(pet => 
          pet.id === petId ? { ...pet, ...updates } : pet
        );
        const updatedActivePet = activePet?.id === petId 
          ? { ...activePet, ...updates } 
          : activePet;
        
        set({ pets: updatedPets, activePet: updatedActivePet });
      },
      createPet: async (petData: Omit<Pet, "id" | "createdAt" | "updatedAt">) => {
        try {
          const newPet = await gameService.createPet(petData);
          if (newPet) {
            get().addPet(newPet);
          }
          return newPet;
        } catch (error) {
          console.error("Error creating pet:", error);
          return null;
        }
      },

      // Currency management
      updateCurrency: async (type: "xenocoins" | "cash", amount: number) => {
        const user = get().user;
        if (!user) return false;

        try {
          const success = await gameService.updateUserCurrency(user.id, type, amount);
          if (success) {
            const currentState = get();
            if (type === "xenocoins") {
              set({ xenocoins: Math.max(0, currentState.xenocoins + amount) });
            } else {
              set({ cash: Math.max(0, currentState.cash + amount) });
            }
          }
          return success;
        } catch (error) {
          console.error("Error updating currency:", error);
          return false;
        }
      },
      setCurrency: (xenocoins: number, cash: number) => set({ xenocoins, cash }),

      // Inventory management
      addToInventory: async (item: Item, quantity = 1) => {
        const user = get().user;
        if (!user) return false;

        try {
          const result = await gameService.addItemToInventory(user.id, item.id, quantity);
          if (result) {
            const currentInventory = get().inventory;
            const existingItemIndex = currentInventory.findIndex(
              invItem => invItem.id === item.id && !invItem.isEquipped
            );

            if (existingItemIndex >= 0) {
              const updatedInventory = [...currentInventory];
              updatedInventory[existingItemIndex] = {
                ...updatedInventory[existingItemIndex],
                quantity: updatedInventory[existingItemIndex].quantity + quantity
              };
              set({ inventory: updatedInventory });
            } else {
              const newInventoryItem = {
                ...item,
                inventoryId: result.id,
                quantity,
                isEquipped: false
              };
              set({ inventory: [...currentInventory, newInventoryItem] });
            }
          }
          return !!result;
        } catch (error) {
          console.error("Error adding to inventory:", error);
          return false;
        }
      },
      removeFromInventory: async (inventoryItemId: string, quantity = 1) => {
        const user = get().user;
        if (!user) return false;

        try {
          const success = await gameService.removeItemFromInventory(user.id, inventoryItemId, quantity);
          if (success) {
            const currentInventory = get().inventory;
            const itemIndex = currentInventory.findIndex(item => item.inventoryId === inventoryItemId);
            
            if (itemIndex >= 0) {
              const updatedInventory = [...currentInventory];
              const currentItem = updatedInventory[itemIndex];
              
              if (currentItem.quantity <= quantity) {
                updatedInventory.splice(itemIndex, 1);
              } else {
                updatedInventory[itemIndex] = {
                  ...currentItem,
                  quantity: currentItem.quantity - quantity
                };
              }
              
              set({ inventory: updatedInventory });
            }
          }
          return success;
        } catch (error) {
          console.error("Error removing from inventory:", error);
          return false;
        }
      },
      useItem: async (inventoryItemId: string, petId: string) => {
        const { inventory, pets, updatePet, removeFromInventory, addNotification } = get();
        
        const item = inventory.find(i => i.inventoryId === inventoryItemId);
        const pet = pets.find(p => p.id === petId);
        
        if (!item || !pet) {
          console.error("Item or pet not found");
          return false;
        }

        try {
          // Apply item effects to pet
          if (item.effects) {
            const updates: Partial<Pet> = {};
            let effectsApplied = false;

            Object.entries(item.effects).forEach(([effect, value]) => {
              if (typeof value === 'number') {
                switch (effect) {
                  case 'health':
                    updates.health = Math.min(10, pet.health + value);
                    effectsApplied = true;
                    break;
                  case 'happiness':
                    updates.happiness = Math.min(10, pet.happiness + value);
                    effectsApplied = true;
                    break;
                  case 'hunger':
                    updates.hunger = Math.min(10, pet.hunger + value);
                    effectsApplied = true;
                    break;
                  case 'strength':
                    updates.strength = Math.max(0, pet.strength + value);
                    effectsApplied = true;
                    break;
                  case 'dexterity':
                    updates.dexterity = Math.max(0, pet.dexterity + value);
                    effectsApplied = true;
                    break;
                  case 'intelligence':
                    updates.intelligence = Math.max(0, pet.intelligence + value);
                    effectsApplied = true;
                    break;
                  case 'speed':
                    updates.speed = Math.max(0, pet.speed + value);
                    effectsApplied = true;
                    break;
                  case 'attack':
                    updates.attack = Math.max(0, pet.attack + value);
                    effectsApplied = true;
                    break;
                  case 'defense':
                    updates.defense = Math.max(0, pet.defense + value);
                    effectsApplied = true;
                    break;
                  case 'precision':
                    updates.precision = Math.max(0, pet.precision + value);
                    effectsApplied = true;
                    break;
                  case 'evasion':
                    updates.evasion = Math.max(0, pet.evasion + value);
                    effectsApplied = true;
                    break;
                  case 'luck':
                    updates.luck = Math.max(0, pet.luck + value);
                    effectsApplied = true;
                    break;
                }
              }
            });

            if (effectsApplied) {
              updates.lastInteraction = new Date();
              
              // Update pet stats in database
              const success = await gameService.updatePetStats(petId, updates);
              if (success) {
                updatePet(petId, updates);
                
                // Remove item from inventory
                await removeFromInventory(inventoryItemId, 1);
                
                // Show success notification
                const effectsList = Object.entries(item.effects)
                  .map(([effect, value]) => `+${value} ${effect}`)
                  .join(', ');
                
                addNotification({
                  type: "success",
                  title: "Item Usado!",
                  message: `${item.name} foi usado em ${pet.name}. Efeitos: ${effectsList}`,
                  isRead: false
                });

                // Play notification sound
                playNotificationSound().catch(() => {});
                
                return true;
              }
            }
          }
          
          return false;
        } catch (error) {
          console.error("Error using item:", error);
          return false;
        }
      },

      // Notification management
      addNotification: (notification: Omit<Notification, "id" | "createdAt">) => {
        const newNotification: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        };
        
        set(state => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50)
        }));

        // Play notification sound for important notifications
        if (notification.type === "success" || notification.type === "achievement") {
          playNotificationSound().catch(() => {});
        }
      },
      markNotificationAsRead: (notificationId: string) => {
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        }));
      },
      markAllNotificationsAsRead: () => {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, isRead: true }))
        }));
      },
      deleteNotification: (notificationId: string) => {
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== notificationId)
        }));
      },
      clearNotifications: () => set({ notifications: [] }),

      // Screen navigation
      setCurrentScreen: (screen: string) => set({ currentScreen: screen }),

      // Store management
      getAllStores: () => {
        // Mock store data - in a real app this would come from a database
        return [
          {
            id: "woodland-store",
            name: "Woodland General Store",
            description: "Your one-stop shop for basic pet supplies and magical items",
            type: "general",
            npcName: "Merchant Elara",
            npcImage: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400",
            npcDialogue: "Welcome, traveler! I have everything you need for your pet's journey.",
            isOpen: true,
            openHours: { start: 6, end: 22 },
            inventory: [
              {
                id: "health-potion-1",
                itemSlug: "health-potion",
                basePrice: 50,
                currentPrice: 50,
                currency: "xenocoins",
                stock: 25,
                isOnSale: false,
                saleDiscount: 0,
                isLimited: false,
                requirements: []
              },
              {
                id: "magic-apple-1",
                itemSlug: "magic-apple",
                basePrice: 25,
                currentPrice: 20,
                currency: "xenocoins",
                stock: 15,
                isOnSale: true,
                saleDiscount: 20,
                isLimited: false,
                requirements: []
              },
              {
                id: "happiness-toy-1",
                itemSlug: "happiness-toy",
                basePrice: 30,
                currentPrice: 30,
                currency: "xenocoins",
                stock: 10,
                isOnSale: false,
                saleDiscount: 0,
                isLimited: false,
                requirements: []
              }
            ],
            specialOffers: [
              {
                id: "weekend-special",
                name: "Weekend Health Bundle",
                originalPrice: 150,
                salePrice: 100,
                currency: "xenocoins",
                expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
              }
            ],
            reputation: 85,
            discountLevel: 2
          },
          {
            id: "premium-boutique",
            name: "Premium Pet Boutique",
            description: "Exclusive high-end items for the most discerning pet owners",
            type: "premium",
            npcName: "Lady Vivienne",
            npcImage: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400",
            npcDialogue: "Only the finest items for pets of distinction. What catches your eye today?",
            isOpen: true,
            openHours: { start: 10, end: 20 },
            inventory: [
              {
                id: "dragon-scale-armor-1",
                itemSlug: "dragon-scale-armor",
                basePrice: 1000,
                currentPrice: 1000,
                currency: "xenocoins",
                stock: 3,
                isOnSale: false,
                saleDiscount: 0,
                isLimited: true,
                requirements: [
                  {
                    type: "level",
                    value: 5,
                    description: "Pet must be level 5 or higher"
                  }
                ]
              },
              {
                id: "king-egg-1",
                itemSlug: "king-egg",
                basePrice: 10000,
                currentPrice: 10000,
                currency: "cash",
                stock: 1,
                isOnSale: false,
                saleDiscount: 0,
                isLimited: true,
                requirements: [
                  {
                    type: "achievement",
                    value: "wealthy",
                    description: "Must have 'Wealthy' achievement"
                  }
                ]
              }
            ],
            specialOffers: [],
            reputation: 95,
            discountLevel: 3
          }
        ];
      },
      getStoresByType: (type: string) => {
        const allStores = get().getAllStores();
        return allStores.filter(store => store.type === type);
      },
      purchaseStoreItem: async (storeId: string, itemId: string, quantity: number) => {
        const { getAllStores, getUniversalItem, updateCurrency, addToInventory, addNotification } = get();
        const stores = getAllStores();
        const store = stores.find(s => s.id === storeId);
        
        if (!store) {
          return {
            success: false,
            message: "Store not found",
            totalCost: 0,
            currency: "xenocoins" as const,
            newBalance: 0
          };
        }

        const storeItem = store.inventory.find(item => item.id === itemId);
        if (!storeItem) {
          return {
            success: false,
            message: "Item not found in store",
            totalCost: 0,
            currency: "xenocoins" as const,
            newBalance: 0
          };
        }

        if (storeItem.stock < quantity) {
          return {
            success: false,
            message: `Not enough stock. Only ${storeItem.stock} available.`,
            totalCost: 0,
            currency: storeItem.currency,
            newBalance: 0
          };
        }

        const totalCost = storeItem.currentPrice * quantity;
        const currentBalance = storeItem.currency === "xenocoins" ? get().xenocoins : get().cash;

        if (currentBalance < totalCost) {
          return {
            success: false,
            message: `Insufficient ${storeItem.currency}. You need ${totalCost.toLocaleString()} but have ${currentBalance.toLocaleString()}.`,
            totalCost,
            currency: storeItem.currency,
            newBalance: currentBalance
          };
        }

        try {
          // Get the universal item
          const universalItem = await getUniversalItem(storeItem.itemSlug);
          if (!universalItem) {
            return {
              success: false,
              message: "Item data not found",
              totalCost,
              currency: storeItem.currency,
              newBalance: currentBalance
            };
          }

          // Deduct currency
          const currencySuccess = await updateCurrency(storeItem.currency, -totalCost);
          if (!currencySuccess) {
            return {
              success: false,
              message: "Failed to process payment",
              totalCost,
              currency: storeItem.currency,
              newBalance: currentBalance
            };
          }

          // Add item to inventory
          const inventorySuccess = await addToInventory(universalItem, quantity);
          if (!inventorySuccess) {
            // Rollback currency change
            await updateCurrency(storeItem.currency, totalCost);
            return {
              success: false,
              message: "Failed to add item to inventory",
              totalCost,
              currency: storeItem.currency,
              newBalance: currentBalance
            };
          }

          // Update store stock (in a real app, this would be persisted)
          storeItem.stock -= quantity;

          const newBalance = currentBalance - totalCost;

          addNotification({
            type: "success",
            title: "Purchase Successful!",
            message: `You bought ${quantity}x ${universalItem.name} for ${totalCost.toLocaleString()} ${storeItem.currency}.`,
            isRead: false
          });

          return {
            success: true,
            message: `Successfully purchased ${quantity}x ${universalItem.name}!`,
            totalCost,
            currency: storeItem.currency,
            newBalance
          };
        } catch (error) {
          console.error("Purchase error:", error);
          return {
            success: false,
            message: "An unexpected error occurred during purchase",
            totalCost,
            currency: storeItem.currency,
            newBalance: currentBalance
          };
        }
      },
      getUniversalItem: async (slug: string) => {
        // Mock universal items - in a real app this would come from a database
        const universalItems: Record<string, Item> = {
          "health-potion": {
            id: "health-potion-universal",
            slug: "health-potion",
            name: "Health Potion",
            description: "A magical elixir that restores 5 health points instantly",
            type: "Potion",
            rarity: "Common",
            price: 50,
            currency: "xenocoins",
            effects: { health: 5 },
            dailyLimit: 10,
            quantity: 1,
            createdAt: new Date()
          },
          "magic-apple": {
            id: "magic-apple-universal",
            slug: "magic-apple",
            name: "Magic Apple",
            description: "A mystical fruit that restores hunger and provides energy",
            type: "Food",
            rarity: "Uncommon",
            price: 25,
            currency: "xenocoins",
            effects: { hunger: 3, happiness: 1 },
            quantity: 1,
            createdAt: new Date()
          },
          "happiness-toy": {
            id: "happiness-toy-universal",
            slug: "happiness-toy",
            name: "Happiness Toy",
            description: "A colorful toy that brings joy to pets",
            type: "Special",
            rarity: "Common",
            price: 30,
            currency: "xenocoins",
            effects: { happiness: 2 },
            dailyLimit: 5,
            quantity: 1,
            createdAt: new Date()
          },
          "dragon-scale-armor": {
            id: "dragon-scale-armor-universal",
            slug: "dragon-scale-armor",
            name: "Dragon Scale Armor",
            description: "Legendary armor forged from ancient dragon scales",
            type: "Equipment",
            rarity: "Epic",
            price: 1000,
            currency: "xenocoins",
            effects: { defense: 10 },
            slot: "torso",
            quantity: 1,
            createdAt: new Date()
          },
          "king-egg": {
            id: "king-egg-universal",
            slug: "king-egg",
            name: "King Egg",
            description: "An extremely rare egg that transforms pet appearance",
            type: "Style",
            rarity: "Unique",
            price: 10000,
            currency: "cash",
            effects: {},
            quantity: 1,
            createdAt: new Date()
          }
        };

        return universalItems[slug] || null;
      },
      restockStore: async (storeId: string) => {
        const { getAllStores, addNotification } = get();
        const stores = getAllStores();
        const store = stores.find(s => s.id === storeId);
        
        if (!store) return false;

        // Restock all items (in a real app, this would be more sophisticated)
        store.inventory.forEach(item => {
          item.stock = Math.min(item.stock + 10, 50); // Add 10, max 50
        });

        addNotification({
          type: "info",
          title: "Store Restocked",
          message: `${store.name} has been restocked with fresh inventory!`,
          isRead: false
        });

        return true;
      },

      // Achievement management
      checkAchievements: () => {
        // Implementation for checking and unlocking achievements
        // This would typically check various game conditions
      },
      unlockAchievement: (achievementId: string) => {
        const { achievements, addNotification } = get();
        const achievement = achievements.find(a => a.id === achievementId);
        
        if (achievement && !achievement.isUnlocked) {
          const updatedAchievements = achievements.map(a =>
            a.id === achievementId 
              ? { ...a, isUnlocked: true, unlockedAt: new Date() }
              : a
          );
          
          set({ achievements: updatedAchievements });
          
          addNotification({
            type: "achievement",
            title: "Achievement Unlocked!",
            message: `You've earned: ${achievement.name}`,
            isRead: false
          });
        }
      },

      // Collectible management
      getAllCollectibles: () => {
        // Mock collectibles data
        return [
          {
            id: "starter-stone",
            name: "Starter Stone",
            type: "stone" as const,
            rarity: "Common" as const,
            description: "A simple stone marking the beginning of your journey",
            isCollected: true,
            collectedAt: new Date(),
            accountPoints: 1,
            obtainMethod: "Starting gift"
          },
          {
            id: "forest-leaf",
            name: "Forest Leaf",
            type: "artwork" as const,
            rarity: "Common" as const,
            description: "A beautiful leaf from the Mystic Forest",
            isCollected: false,
            accountPoints: 1,
            obtainMethod: "Found in Mystic Forest"
          },
          {
            id: "alpha-egg",
            name: "Ovo Alpha",
            type: "egg" as const,
            rarity: "Unique" as const,
            description: "Distribuído através de código para jogadores do alpha",
            isCollected: false,
            accountPoints: 10,
            obtainMethod: "Alpha player code"
          }
        ];
      },
      getCollectiblesByType: (type: "egg" | "fish" | "gem" | "stamp" | "stone" | "artwork") => {
        return get().getAllCollectibles().filter(c => c.type === type);
      },
      getCollectedCollectibles: () => {
        return get().getAllCollectibles().filter(c => c.isCollected);
      },
      getTotalCollectiblePoints: () => {
        return get().getCollectedCollectibles().reduce((total, c) => total + c.accountPoints, 0);
      },
      collectItem: async (collectibleName: string) => {
        const user = get().user;
        if (!user) return false;

        try {
          const success = await gameService.addUserCollectible(user.id, collectibleName);
          if (success) {
            // Update local state
            const collectibles = get().getAllCollectibles();
            const collectible = collectibles.find(c => c.name === collectibleName);
            if (collectible) {
              collectible.isCollected = true;
              collectible.collectedAt = new Date();
            }
          }
          return success;
        } catch (error) {
          console.error("Error collecting item:", error);
          return false;
        }
      },

      // Daily check-in
      dailyCheckin: () => {
        const user = get().user;
        if (!user) return;

        const today = new Date().toDateString();
        const lastCheckin = localStorage.getItem(`lastCheckin_${user.id}`);
        
        if (lastCheckin === today) return;

        localStorage.setItem(`lastCheckin_${user.id}`, today);
        
        // Award daily bonus
        get().updateCurrency("xenocoins", 100);
        
        get().addNotification({
          type: "success",
          title: "Daily Check-in!",
          message: "You received 100 Xenocoins for checking in today!",
          isRead: false
        });
      },
      canClaimDailyCheckin: () => {
        const user = get().user;
        if (!user) return false;

        const today = new Date().toDateString();
        const lastCheckin = localStorage.getItem(`lastCheckin_${user.id}`);
        
        return lastCheckin !== today;
      },
      getDailyCheckinStreak: () => {
        const user = get().user;
        if (!user) return 0;

        // Simple streak calculation - in a real app this would be more sophisticated
        const streak = parseInt(localStorage.getItem(`checkinStreak_${user.id}`) || "0");
        return streak;
      },
      canClaimWeeklyReward: () => {
        return get().getDailyCheckinStreak() >= 7;
      },
      claimWeeklyReward: () => {
        const user = get().user;
        if (!user || !get().canClaimWeeklyReward()) return;

        get().updateCurrency("cash", 1);
        localStorage.setItem(`checkinStreak_${user.id}`, "0");
        
        get().addNotification({
          type: "success",
          title: "Weekly Reward!",
          message: "You received 1 Cash for your 7-day streak!",
          isRead: false
        });
      },

      // Redeem codes
      getAllRedeemCodes: () => {
        // Mock redeem codes - in a real app this would come from database
        return [
          {
            id: "alpha-code-1",
            code: "ALPHA2025",
            name: "Alpha Player Reward",
            description: "Special reward for alpha testers",
            rewards: {
              xenocoins: 1000,
              cash: 5,
              collectibles: ["Ovo Alpha"],
              accountPoints: 100
            },
            maxUses: 100,
            currentUses: 25,
            isActive: true,
            createdBy: "admin",
            createdAt: new Date("2025-01-01"),
            usedBy: []
          }
        ];
      },
      getActiveRedeemCodes: () => {
        return get().getAllRedeemCodes().filter(code => 
          code.isActive && 
          (code.maxUses === -1 || code.currentUses < code.maxUses) &&
          (!code.expiresAt || code.expiresAt > new Date())
        );
      },
      createRedeemCode: (codeData: Omit<RedeemCode, "id" | "createdAt" | "currentUses" | "usedBy">) => {
        const newCode: RedeemCode = {
          ...codeData,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          currentUses: 0,
          usedBy: []
        };
        
        const codes = get().getAllRedeemCodes();
        // In a real app, this would be saved to database
        console.log("Created new redeem code:", newCode);
      },
      updateRedeemCode: (codeId: string, updates: Partial<RedeemCode>) => {
        // In a real app, this would update the database
        console.log("Updated redeem code:", codeId, updates);
      },
      deleteRedeemCode: (codeId: string) => {
        // In a real app, this would delete from database
        console.log("Deleted redeem code:", codeId);
      },
      redeemCode: async (code: string) => {
        const user = get().user;
        if (!user) {
          return { success: false, message: "User not logged in" };
        }

        const redeemCodes = get().getActiveRedeemCodes();
        const redeemCode = redeemCodes.find(c => c.code.toLowerCase() === code.toLowerCase());
        
        if (!redeemCode) {
          return { success: false, message: "Código inválido ou expirado" };
        }

        if (redeemCode.usedBy.includes(user.id)) {
          return { success: false, message: "Você já resgatou este código" };
        }

        if (redeemCode.maxUses !== -1 && redeemCode.currentUses >= redeemCode.maxUses) {
          return { success: false, message: "Este código atingiu o limite de usos" };
        }

        try {
          // Apply rewards
          const { rewards } = redeemCode;
          let rewardMessages: string[] = [];

          if (rewards.xenocoins) {
            await get().updateCurrency("xenocoins", rewards.xenocoins);
            rewardMessages.push(`${rewards.xenocoins} Xenocoins`);
          }

          if (rewards.cash) {
            await get().updateCurrency("cash", rewards.cash);
            rewardMessages.push(`${rewards.cash} Cash`);
          }

          if (rewards.accountPoints) {
            get().updateUser({ accountScore: (user.accountScore || 0) + rewards.accountPoints });
            rewardMessages.push(`${rewards.accountPoints} pontos de conta`);
          }

          if (rewards.collectibles) {
            for (const collectibleName of rewards.collectibles) {
              await get().collectItem(collectibleName);
              rewardMessages.push(`Colecionável: ${collectibleName}`);
            }
          }

          // Mark code as used (in a real app, this would update the database)
          redeemCode.usedBy.push(user.id);
          redeemCode.currentUses++;

          const message = `Código resgatado com sucesso! Você recebeu: ${rewardMessages.join(", ")}`;
          
          get().addNotification({
            type: "success",
            title: "Código Resgatado!",
            message,
            isRead: false
          });

          return { success: true, message };
        } catch (error) {
          console.error("Error redeeming code:", error);
          return { success: false, message: "Erro ao resgatar código. Tente novamente." };
        }
      },

      // Player search and profiles
      searchPlayers: async (query: string) => {
        try {
          return await gameService.searchPlayers(query);
        } catch (error) {
          console.error("Error searching players:", error);
          return [];
        }
      },
      getPlayerProfile: async (userId: string) => {
        try {
          return await gameService.getPlayerProfile(userId);
        } catch (error) {
          console.error("Error fetching player profile:", error);
          return null;
        }
      },
      setViewedUserId: (userId: string | null) => set({ viewedUserId: userId }),

      // Data loading and real-time updates
      loadUserData: async (userId: string) => {
        try {
          // Load pets
          const pets = await gameService.getUserPets(userId);
          const activePet = pets.find(pet => pet.isActive) || pets[0] || null;
          
          // Load inventory
          const inventory = await gameService.getUserInventory(userId);
          
          // Load currency
          const currency = await gameService.getUserCurrency(userId);
          
          // Load notifications
          const notifications = await gameService.getUserNotifications(userId);
          
          // Load achievements
          const achievements = await gameService.getUserAchievements(userId);

          set({
            pets,
            activePet,
            inventory,
            xenocoins: currency?.xenocoins || 0,
            cash: currency?.cash || 0,
            notifications,
            achievements
          });
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      },
      loadUserAchievements: async (userId: string) => {
        try {
          const achievements = await gameService.getUserAchievements(userId);
          set({ achievements });
        } catch (error) {
          console.error("Error loading user achievements:", error);
        }
      },
      loadUserCollectibles: async (userId: string) => {
        try {
          const collectibles = await gameService.getUserCollectedCollectibles(userId);
          // Update collectibles state with collected items
          // This would be more sophisticated in a real app
          console.log("Loaded user collectibles:", collectibles);
        } catch (error) {
          console.error("Error loading user collectibles:", error);
        }
      },
      subscribeToRealtimeUpdates: () => {
        const user = get().user;
        if (!user || get().subscriptionId) return;

        const subscriptionId = gameService.subscribeToUserData(user.id, (data) => {
          // Handle real-time updates
          console.log("Real-time update:", data);
          
          switch (data.type) {
            case "pets":
              get().loadUserData(user.id);
              break;
            case "inventory":
              get().loadUserData(user.id);
              break;
            case "currency":
              get().loadUserData(user.id);
              break;
            case "notifications":
              get().loadUserData(user.id);
              break;
          }
        });

        set({ subscriptionId });
      },
      unsubscribeFromRealtimeUpdates: () => {
        const subscriptionId = get().subscriptionId;
        if (subscriptionId) {
          gameService.unsubscribe(subscriptionId);
          set({ subscriptionId: null });
        }
      },
    }),
    {
      name: "xenopets-game",
      partialize: (state) => ({
        user: state.user,
        activePet: state.activePet,
        pets: state.pets,
        inventory: state.inventory,
        xenocoins: state.xenocoins,
        cash: state.cash,
        notifications: state.notifications,
        language: state.language,
        currentScreen: state.currentScreen,
        achievements: state.achievements,
        collectibles: state.collectibles,
        quests: state.quests,
        redeemCodes: state.redeemCodes,
        shipPosition: state.shipPosition, // Persist ship position
        selectedEggForHatching: state.selectedEggForHatching,
        isHatchingInProgress: state.isHatchingInProgress,
        hatchingEgg: state.hatchingEgg,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Rehydrate dates
          if (state.user) state.user = rehydrateDates(state.user);
          if (state.activePet) state.activePet = rehydrateDates(state.activePet);
          if (state.pets) state.pets = state.pets.map(rehydrateDates);
          if (state.inventory) state.inventory = state.inventory.map(rehydrateDates);
          if (state.notifications) state.notifications = state.notifications.map(rehydrateDates);
          if (state.achievements) state.achievements = state.achievements.map(rehydrateDates);
          if (state.collectibles) state.collectibles = state.collectibles.map(rehydrateDates);
          if (state.quests) state.quests = state.quests.map(rehydrateDates);
          if (state.redeemCodes) state.redeemCodes = state.redeemCodes.map(rehydrateDates);
          if (state.hatchingEgg) state.hatchingEgg = rehydrateDates(state.hatchingEgg);
        }
      },
    }
  )
);
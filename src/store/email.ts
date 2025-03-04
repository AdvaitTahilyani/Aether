import { create } from "zustand";
import { EmailDetails } from "../types/email";

interface EmailStore {
  currentSelectedEmail: EmailDetails | null;
  setCurrentSelectedEmail: (email: EmailDetails | null) => void;
}

export const useEmailStore = create<EmailStore>((set) => ({
  currentSelectedEmail: null,
  setCurrentSelectedEmail: (email: EmailDetails | null) =>
    set({ currentSelectedEmail: email }),
}));

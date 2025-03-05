import { create } from "zustand";
import { EmailDetails } from "../types/email";

interface EmailStore {
  userEmail: string | null;
  currentSelectedEmail: EmailDetails | null;
  emailList: EmailDetails[];
  setUserEmail: (userEmail: string | null) => void;
  setCurrentSelectedEmail: (email: EmailDetails | null) => void;
  setEmailList: (emails: EmailDetails[]) => void;
}

export const useEmailStore = create<EmailStore>((set) => ({
  userEmail: null,
  currentSelectedEmail: null,
  emailList: [],
  setUserEmail: (userEmail: string | null) => set({ userEmail }),
  setCurrentSelectedEmail: (email: EmailDetails | null) =>
    set({ currentSelectedEmail: email }),
  setEmailList: (emails: EmailDetails[]) => set({ emailList: emails }),
}));

// Global augmentation in a source module is included by preview typechecking.
export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  }

  namespace NodeJS {
    interface ProcessEnv {
      readonly SUPABASE_URL?: string;
      readonly SUPABASE_PUBLISHABLE_KEY?: string;
      readonly VITE_SUPABASE_URL?: string;
      readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    }
  }
}
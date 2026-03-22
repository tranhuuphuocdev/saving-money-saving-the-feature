export type TypeThemeMode = 'dark' | 'light';

export interface IThemeContextValue {
    theme: TypeThemeMode;
    toggleTheme: () => void;
}

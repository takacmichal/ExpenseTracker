import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

/**
 * Amber on indigo, read off an instrument panel.
 *
 * The palette is the data: money leaving is coral, money arriving is cyan, money kept is amber.
 * Amber doubles as the brand colour so "what you kept" and "the product" read as the same idea.
 * Surfaces are indigo rather than neutral black so the amber sits warm against a cool ground.
 */

/** Shared with the Chart.js configs, which cannot read CSS custom properties. */
export const chartPalette = {
  bg: '#0e1120',
  surface: '#161a2c',
  surface2: '#1e2338',
  line: '#262b45',
  text: '#e5e8f5',
  muted: '#949bc2',
  faint: '#8189b4',
  out: '#e8785f',
  in: '#52b8cf',
  kept: '#e8a72c',
} as const;

export const ExpenseTrackerTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fdf6e7',
      100: '#f9e8c2',
      200: '#f4d795',
      300: '#efc566',
      400: '#ebb544',
      500: '#e8a72c',
      600: '#cc8f21',
      700: '#a3711a',
      800: '#7c5514',
      900: '#573b0e',
      950: '#332208',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#e5e8f5',
          100: '#c6cbe4',
          200: '#a7aed2',
          300: '#8189b4',
          400: '#6a72a0',
          500: '#4e5580',
          600: '#383e63',
          700: '#262b45',
          800: '#1e2338',
          900: '#161a2c',
          950: '#0e1120',
        },
        primary: {
          color: '#e8a72c',
          contrastColor: '#1a1204',
          hoverColor: '#efc566',
          activeColor: '#cc8f21',
        },
        highlight: {
          background: 'rgba(232, 167, 44, 0.14)',
          focusBackground: 'rgba(232, 167, 44, 0.22)',
          color: '#efc566',
          focusColor: '#f9e8c2',
        },
        content: {
          background: '#161a2c',
          hoverBackground: '#1e2338',
          borderColor: '#262b45',
          color: '#e5e8f5',
        },
        text: {
          color: '#e5e8f5',
          hoverColor: '#ffffff',
          mutedColor: '#949bc2',
          hoverMutedColor: '#c6cbe4',
        },
        formField: {
          background: '#090b16',
          filledBackground: '#090b16',
          borderColor: '#262b45',
          hoverBorderColor: '#383e63',
          focusBorderColor: '#e8a72c',
          color: '#e5e8f5',
          placeholderColor: '#8189b4',
        },
        overlay: {
          modal: { background: '#161a2c', borderColor: '#262b45', color: '#e5e8f5' },
          popover: { background: '#161a2c', borderColor: '#262b45', color: '#e5e8f5' },
          select: { background: '#161a2c', borderColor: '#262b45', color: '#e5e8f5' },
        },
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: '0.4375rem',
        paddingX: '1rem',
        gap: '0.5rem',
        label: { fontWeight: '600' },
      },
    },
    card: {
      root: {
        background: '#161a2c',
        borderRadius: '0.75rem',
        color: '#e5e8f5',
        shadow: 'none',
      },
      body: { padding: '1.25rem' },
      title: { fontSize: '0.8125rem', fontWeight: '600' },
    },
    datatable: {
      headerCell: {
        background: 'transparent',
        color: '#8189b4',
        borderColor: '#262b45',
      },
      bodyCell: { borderColor: '#1e2338' },
      row: { background: 'transparent', hoverBackground: '#1e2338' },
    },
    dialog: { root: { borderRadius: '0.75rem' } },
    inputtext: { root: { borderRadius: '0.4375rem' } },
    select: { root: { borderRadius: '0.4375rem' } },
    tag: { root: { borderRadius: '0.25rem', fontWeight: '600' } },
  },
});

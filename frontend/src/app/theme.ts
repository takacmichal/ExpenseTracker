import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

/**
 * Brass on deep petrol ink.
 *
 * The palette is the data: money leaving is ember, money arriving is tide, money kept is brass.
 * Brass doubles as the brand colour so "what you kept" and "the product" read as the same idea.
 */
export const ExpenseTrackerTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fbf5e9',
      100: '#f4e6c6',
      200: '#ecd39d',
      300: '#e3bf72',
      400: '#dcb055',
      500: '#d9a441',
      600: '#c08f36',
      700: '#9c722a',
      800: '#78571f',
      900: '#553d15',
      950: '#33240c',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#e6edf1',
          100: '#c3d0d8',
          200: '#9fb2bd',
          300: '#7b94a2',
          400: '#5c7683',
          500: '#425863',
          600: '#2d3f49',
          700: '#22323b',
          800: '#18242b',
          900: '#121b21',
          950: '#0b1115',
        },
        primary: {
          color: '#d9a441',
          contrastColor: '#1a1206',
          hoverColor: '#e3bf72',
          activeColor: '#c08f36',
        },
        highlight: {
          background: 'rgba(217, 164, 65, 0.14)',
          focusBackground: 'rgba(217, 164, 65, 0.22)',
          color: '#e3bf72',
          focusColor: '#f4e6c6',
        },
        content: {
          background: '#121b21',
          hoverBackground: '#18242b',
          borderColor: '#22323b',
          color: '#e6edf1',
        },
        text: {
          color: '#e6edf1',
          hoverColor: '#ffffff',
          mutedColor: '#8da2ae',
          hoverMutedColor: '#c3d0d8',
        },
        formField: {
          background: '#0e161b',
          filledBackground: '#0e161b',
          borderColor: '#22323b',
          hoverBorderColor: '#2d3f49',
          focusBorderColor: '#d9a441',
          color: '#e6edf1',
          placeholderColor: '#5c7683',
        },
        overlay: {
          modal: { background: '#121b21', borderColor: '#22323b', color: '#e6edf1' },
          popover: { background: '#121b21', borderColor: '#22323b', color: '#e6edf1' },
          select: { background: '#121b21', borderColor: '#22323b', color: '#e6edf1' },
        },
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: '0.5rem',
        paddingX: '1rem',
        gap: '0.5rem',
        label: { fontWeight: '600' },
      },
    },
    card: {
      root: {
        background: '#121b21',
        borderRadius: '0.875rem',
        color: '#e6edf1',
        shadow: 'none',
      },
      body: { padding: '1.25rem' },
      title: { fontSize: '0.8125rem', fontWeight: '600' },
    },
    datatable: {
      headerCell: {
        background: 'transparent',
        color: '#8da2ae',
        borderColor: '#22323b',
      },
      bodyCell: { borderColor: '#18242b' },
      row: { background: 'transparent', hoverBackground: '#18242b' },
    },
    dialog: { root: { borderRadius: '0.875rem' } },
    inputtext: { root: { borderRadius: '0.5rem' } },
    select: { root: { borderRadius: '0.5rem' } },
    tag: { root: { borderRadius: '0.375rem', fontWeight: '600' } },
  },
});

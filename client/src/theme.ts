import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    pos: { tableAvailable: string; tableOccupied: string; tableReserved: string; tableCleaning: string };
  }
  interface PaletteOptions {
    pos?: { tableAvailable?: string; tableOccupied?: string; tableReserved?: string; tableCleaning?: string };
  }
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#0078d4', light: '#2899f5', dark: '#106ebe' },
    secondary: { main: '#00b7c3', light: '#50e6ff', dark: '#008a8f' },
    success: { main: '#57a300', light: '#92c353', dark: '#3d7a00' },
    warning: { main: '#c19c00', light: '#f7e083', dark: '#8a6e00' },
    error: { main: '#c42b1c', light: '#e37166', dark: '#8e1a0e' },
    background: {
      default: '#141414',
      paper: '#242424',
    },
    text: { primary: '#ffffff', secondary: '#adadad' },
    divider: 'rgba(255,255,255,0.1)',
    pos: {
      tableAvailable: '#57a300',
      tableOccupied: '#c42b1c',
      tableReserved: '#c19c00',
      tableCleaning: '#0078d4',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 16,
    h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 400, letterSpacing: 0 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.9375rem' },
    caption: { fontSize: '0.875rem' },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 18px',
          fontSize: '1rem',
          fontWeight: 400,
        },
        sizeLarge: { padding: '12px 22px', fontSize: '1.0625rem' },
        sizeSmall: { padding: '5px 12px', fontSize: '0.875rem' },
        contained: { boxShadow: 'none' },
        containedPrimary: {
          '&:hover': { backgroundColor: '#106ebe', boxShadow: 'none' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: 'none',
          '&:hover': { borderColor: 'rgba(255,255,255,0.18)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundClip: 'padding-box' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontWeight: 400, fontSize: '0.875rem' },
        sizeSmall: { height: 24 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid rgba(255,255,255,0.1)' },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.9375rem',
            letterSpacing: 0,
            color: '#adadad',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '1rem' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          minHeight: 46,
          '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: '1rem' } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
          fontSize: '0.9375rem',
        },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: 4 } },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: 2 } },
    },
  },
});

export default theme;

export const glassMorphism = {
  background: alpha('#ffffff', 0.04),
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.1)',
};

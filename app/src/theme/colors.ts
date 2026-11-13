/**
 * Paleta de CheckHome. Todo color de la app sale de aquí.
 * Cada par texto/fondo usado en componentes cumple contraste WCAG AA (≥ 4.5:1).
 */
export type ColorTokens = {
  /** Fondo general de la pantalla */
  background: string;
  /** Tarjetas, hojas, campos */
  surface: string;
  /** Superficie secundaria: filas alternas, chips neutros, botón secundario */
  surfaceAlt: string;
  border: string;
  /** Texto principal */
  text: string;
  /** Texto secundario (subtítulos, ayudas) */
  textMuted: string;
  /** Texto terciario y placeholders */
  textSubtle: string;

  /** Marca: verde azulado. Acciones principales y Cuentas */
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;

  /** Tareas y puntos */
  points: string;
  pointsSoft: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;

  /** Velo detrás de modales */
  overlay: string;
  /** Sombra (solo modo claro; en oscuro se usa borde) */
  shadow: string;
};

export const lightColors: ColorTokens = {
  background: '#F7F6F3',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEDE8',
  border: '#E3E0DA',
  text: '#1A1D1C',
  textMuted: '#5F6663',
  textSubtle: '#8A908D',

  primary: '#0B7A5E',
  primaryPressed: '#08634C',
  primarySoft: '#DDF3EC',
  onPrimary: '#FFFFFF',

  points: '#5B45C2',
  pointsSoft: '#ECE8FC',

  success: '#0B7A5E',
  successSoft: '#DDF3EC',
  warning: '#8A6100',
  warningSoft: '#FFF1D6',
  danger: '#B42318',
  dangerSoft: '#FDE4E1',
  onDanger: '#FFFFFF',

  overlay: 'rgba(15, 18, 17, 0.45)',
  shadow: '#1A1D1C',
};

export const darkColors: ColorTokens = {
  background: '#0F1211',
  surface: '#181C1B',
  surfaceAlt: '#222726',
  border: '#2D3331',
  text: '#F1F3F2',
  textMuted: '#A6AEAB',
  textSubtle: '#78817E',

  primary: '#3DD1A4',
  primaryPressed: '#2DB58C',
  primarySoft: '#12352B',
  onPrimary: '#052019',

  points: '#B3A4F7',
  pointsSoft: '#2A2447',

  success: '#3DD1A4',
  successSoft: '#12352B',
  warning: '#F5B44A',
  warningSoft: '#3A2C10',
  danger: '#FF7A6E',
  dangerSoft: '#3D1A17',
  onDanger: '#2A0805',

  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

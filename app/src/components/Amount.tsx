import { useTheme } from '../theme';
import { Text, type TextProps } from './Text';

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export function formatCLP(value: number) {
  return clp.format(value);
}

type AmountProps = Omit<TextProps, 'children' | 'color'> & {
  value: number;
  /** Ingresos en verde con "+", gastos en texto normal con "−" */
  sign?: 'income' | 'expense' | 'none';
  size?: 'list' | 'display';
};

/** Monto en pesos chilenos con números de ancho fijo. */
export function Amount({ value, sign = 'none', size = 'list', ...rest }: AmountProps) {
  const t = useTheme();
  const prefix = sign === 'income' ? '+' : sign === 'expense' ? '−' : '';
  return (
    <Text
      {...rest}
      variant={size === 'display' ? 'display' : 'amount'}
      color={sign === 'income' ? 'success' : 'text'}
      accessibilityLabel={`${sign === 'expense' ? 'menos ' : ''}${formatCLP(Math.abs(value))}`}
    >
      {prefix}
      {formatCLP(Math.abs(value)).replace(/\s/g, '')}
    </Text>
  );
}

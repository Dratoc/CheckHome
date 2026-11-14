import { useState } from 'react';
import { View } from 'react-native';
import {
  Amount,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Fab,
  ListItem,
  ProgressBar,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
  TextField,
} from '../components';
import { useTheme, type ColorSchemePreference } from '../theme';

/**
 * Vitrina del sistema de diseño. Sirve para revisar tokens y componentes en claro y oscuro
 * mientras no existan las pantallas reales. Se reemplaza por la navegación en la Fase 0.
 */
export function DesignPreview() {
  const t = useTheme();
  const [checks, setChecks] = useState({ dishes: true, trash: false, plants: false });
  const [tab, setTab] = useState<'hoy' | 'rutinas' | 'backlog'>('hoy');
  const done = Object.values(checks).filter(Boolean).length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: t.spacing.xxs }}>
          <Text variant="overline" color="textMuted">
            Casa Muñoz
          </Text>
          <Text variant="title">Hola, Hernán</Text>
        </View>
        <Avatar name="Hernán Muñoz" size="lg" />
      </View>

      <SegmentedControl<ColorSchemePreference>
        value={t.preference}
        onChange={t.setPreference}
        options={[
          { value: 'system', label: 'Sistema' },
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Oscuro' },
        ]}
      />

      <Card tone="tinted" padding="xl">
        <Text variant="label" color="textMuted">
          Balance de noviembre
        </Text>
        <Amount value={842300} size="display" />
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Badge label="Ingresos $2.150.000" tone="success" />
          <Badge label="Gastos $1.307.700" tone="neutral" />
        </View>
      </Card>

      <SectionHeader title="Próximos vencimientos" action="Ver todo" />
      <Card padding="md">
        <ListItem
          divider
          leading={<Avatar name="Luz Enel" size="sm" />}
          title="Luz"
          subtitle="Vence el 15 nov"
          trailing={<Badge label="En 2 días" tone="warning" dot />}
        />
        <ListItem
          divider
          leading={<Avatar name="Permiso Circulación" size="sm" />}
          title="Permiso de circulación"
          subtitle="Venció el 10 nov"
          trailing={<Badge label="Atrasado" tone="danger" dot />}
        />
        <ListItem
          leading={<Avatar name="Internet Fibra" size="sm" />}
          title="Internet"
          subtitle="Pagado el 5 nov"
          trailing={<Badge label="Al día" tone="success" dot />}
        />
      </Card>

      <SectionHeader title="Movimientos" />
      <Card padding="md">
        <ListItem divider title="Supermercado" subtitle="Hoy · Comida" trailing={<Amount value={-48990} sign="expense" />} />
        <ListItem divider title="Sueldo" subtitle="1 nov · Hernán" trailing={<Amount value={1650000} sign="income" />} />
        <ListItem title="Arriendo depto" subtitle="5 nov · Propiedad" trailing={<Amount value={500000} sign="income" />} />
      </Card>

      <SectionHeader title="Tareas" />
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'hoy', label: 'Hoy' },
          { value: 'rutinas', label: 'Rutinas' },
          { value: 'backlog', label: 'Backlog' },
        ]}
      />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="label" color="textMuted">
            Checklist de hoy
          </Text>
          <Text variant="label">
            {done} de 3
          </Text>
        </View>
        <ProgressBar value={done / 3} accessibilityLabel="Avance del checklist" />
        <Checkbox label="Lavar la loza" hint="+2 pts · Ana" checked={checks.dishes} onChange={(v) => setChecks({ ...checks, dishes: v })} />
        <Checkbox label="Sacar la basura" hint="+1 pt · Tomás" checked={checks.trash} onChange={(v) => setChecks({ ...checks, trash: v })} />
        <Checkbox label="Regar las plantas" hint="+1 pt · Hernán" checked={checks.plants} onChange={(v) => setChecks({ ...checks, plants: v })} />
      </Card>

      <Card tone="points">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading">Limpiar la bodega</Text>
          <Badge label="8 pts" tone="points" />
        </View>
        <Text variant="body" color="textMuted">
          Estimada por 3 de 4 miembros
        </Text>
        <Button label="Me la llevo" variant="primary" size="sm" />
      </Card>

      <SectionHeader title="Formulario" />
      <Card>
        <TextField label="Monto" prefix="$" placeholder="0" keyboardType="number-pad" hint="En pesos" />
        <TextField label="Código de invitación" placeholder="Ej. K7P-2QX" autoCapitalize="characters" error="Ese código no existe o ya venció" />
      </Card>

      <SectionHeader title="Botones" />
      <View style={{ gap: t.spacing.sm }}>
        <Button label="Guardar gasto" block size="lg" />
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
          <Button label="Cancelar" variant="secondary" />
          <Button label="Ver detalle" variant="ghost" />
          <Button label="Eliminar" variant="danger" />
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Button label="Cargando" loading />
          <Button label="Desactivado" disabled />
        </View>
      </View>

      <Fab label="Gasto" accessibilityLabel="Agregar gasto" />
    </Screen>
  );
}

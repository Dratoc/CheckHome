import Ionicons from '@expo/vector-icons/Ionicons';
import { Badge, Button, Card, EmptyState, ListItem, QueryView, Screen } from '../../components';
import { useQuery } from '../../hooks/useQuery';
import type { RootScreenProps } from '../../navigation/types';
import * as api from '../../services/api';
import { useHousehold } from '../../state/SessionProvider';
import { useTheme } from '../../theme';
import { SPECIES } from '../../utils/categories';
import { PetAvatar, keyDateBadge, petAge, urgentKeyDate } from './subjectUi';

/** Mascotas del hogar: cada una abre su ficha con rutinas, fechas clave y documentos. */
export function PetsScreen({ navigation }: RootScreenProps<'Pets'>) {
  const t = useTheme();
  const { household } = useHousehold();
  const query = useQuery(() => api.listPets(household.id), [household.id]);
  const add = () => navigation.navigate('AddPet');

  return (
    <Screen edges={['bottom']}>
      <QueryView
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState
              title="Sin mascotas"
              message="Agrega a cada una para ver en Inicio si ya comió o paseó, y para no olvidar sus vacunas."
              action="Agregar mascota"
              onAction={add}
            />
          </Card>
        }
      >
        {(rows) => (
          <>
            <Card padding="md">
              {rows.map((p, i) => {
                const urgent = urgentKeyDate(p.keyDates);
                const b = urgent && keyDateBadge(urgent);
                const details = [SPECIES.find((s) => s.value === p.species)?.label, petAge(p)].filter(Boolean).join(' · ');
                return (
                  <ListItem
                    key={p.id}
                    title={p.name}
                    subtitle={urgent ? `${urgent.title} · ${details}` : details}
                    leading={<PetAvatar species={p.species} />}
                    trailing={b ? <Badge label={b.label} tone={b.tone} dot /> : <Ionicons name="chevron-forward" size={20} color={t.colors.textMuted} />}
                    onPress={() => navigation.navigate('Pet', { petId: p.id, name: p.name })}
                    divider={i < rows.length - 1}
                  />
                );
              })}
            </Card>
            <Button label="Agregar mascota" variant="secondary" block onPress={add} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

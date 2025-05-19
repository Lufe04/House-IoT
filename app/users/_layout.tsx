// app/users/_layout.tsx
import { Tabs }     from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth }  from '@/context/AuthContext';

export default function UsersLayout() {
  const { userData } = useAuth();
  const role = userData?.role ?? 'child';   // father | mother | child

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#20ADF5',
        tabBarStyle: { backgroundColor: '#1A2E46' },
      }}
    >
      {/* Home: visible para todos */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="home" color={color} size={size} />,
        }}
      />

      {/* Historial: se oculta en la barra si el rol es child */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: role === 'child' ? null : undefined,  // ← truco para ocultar
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="time" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

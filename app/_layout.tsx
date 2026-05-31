import { BarChart3, CalendarDays, CirclePlus, ListChecks, Settings } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/src/components/ui';
import { initializeDatabase } from '@/src/db/client';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDatabase().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ alignItems: 'center', backgroundColor: colors.paper, flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.blue} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.paper },
          headerTitleStyle: { color: colors.ink, fontWeight: '900' },
          tabBarActiveTintColor: colors.blue,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.softLine },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="trends"
          options={{
            title: 'Trends',
            tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="routines"
          options={{
            title: 'Routines',
            tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="practices"
          options={{
            title: 'Practices',
            tabBarIcon: ({ color, size }) => <CirclePlus color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
          }}
        />
        <Tabs.Screen name="review/[date]" options={{ href: null, title: 'Review' }} />
      </Tabs>
    </SafeAreaProvider>
  );
}

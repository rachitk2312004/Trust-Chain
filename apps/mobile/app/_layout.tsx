import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import "react-native-get-random-values";

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

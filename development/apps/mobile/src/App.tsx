import 'react-native-url-polyfill/auto'
import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View, SafeAreaView } from 'react-native'
import { SupabaseProvider } from './providers/SupabaseProvider'
import { AuthProvider } from './providers/AuthProvider'
import AppNavigator from './navigation/AppNavigator'

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <SupabaseProvider>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </SupabaseProvider>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
})

import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>NetNeural Mobile</Text>
      <Text style={styles.subtitle}>IoT Platform Mobile App</Text>
      <View style={styles.featureGrid}>
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Device Control</Text>
          <Text style={styles.featureText}>Manage IoT devices remotely</Text>
        </View>
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Real-time Data</Text>
          <Text style={styles.featureText}>Monitor sensor readings live</Text>
        </View>
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Alerts</Text>
          <Text style={styles.featureText}>Receive instant notifications</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 40,
  },
  featureGrid: {
    width: '100%',
    maxWidth: 400,
  },
  featureCard: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
    color: '#64748b',
  },
});

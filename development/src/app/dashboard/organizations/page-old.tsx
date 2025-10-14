'use client';

import React, { useState, useEffect } from 'react';

interface Integration {
  id: string;
  name: string;
  type: 'azure-iot' | 'aws-iot' | 'google-iot' | 'golioth' | 'netneural-gateway' | 'mqtt-broker' | 'cellular-gateway';
  status: 'active' | 'inactive' | 'error';
  description: string;
  lastSync?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  integrations: Integration[];
}

export default function OrganizationManagementPage() {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [modalType, setModalType] = useState<'configure' | 'test' | 'add'>('configure');

  useEffect(() => {
    const mockOrg: Organization = {
      id: '1',
      name: 'NetNeural Technologies',
      slug: 'netneural',
      role: 'admin',
      integrations: [
        {
          id: '1',
          name: 'Azure IoT Hub',
          type: 'azure-iot',
          status: 'active',
          description: 'Main IoT data ingestion from Azure IoT Hub',
          lastSync: '2024-12-19T10:30:00Z'
        },
        {
          id: '4',
          name: 'Golioth IoT Platform',
          type: 'golioth',
          status: 'active',
          description: 'Cloud-native IoT platform for device management',
          lastSync: '2024-12-19T11:15:00Z'
        }
      ]
    };
    setCurrentOrganization(mockOrg);
  }, []);

  const handleConfigureIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setModalType('configure');
    setShowConfigModal(true);
  };

  const handleTestIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setModalType('test');
    setShowConfigModal(true);
  };

  const handleAddIntegration = () => {
    setSelectedIntegration(null);
    setModalType('add');
    setShowConfigModal(true);
  };

  const closeModal = () => {
    setShowConfigModal(false);
    setSelectedIntegration(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  if (!currentOrganization) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Organization Management</h1>
        <p className="text-gray-600">Manage your organization settings and integrations</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">{currentOrganization.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Role: {currentOrganization.role}</p>
        </div>
        
        <div className="p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">Integrations</h3>
          
          <div className="space-y-4">
            {currentOrganization.integrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{integration.name}</h4>
                  <p className="text-sm text-gray-600">{integration.description}</p>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleConfigureIntegration(integration)}
                    className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                  >
                    Configure
                  </button>
                  <button
                    onClick={() => handleTestIntegration(integration)}
                    className="px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                  >
                    Test
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleAddIntegration}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Integration
            </button>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {modalType === 'configure' && selectedIntegration && `Configure ${selectedIntegration.name}`}
                  {modalType === 'test' && selectedIntegration && `Test ${selectedIntegration.name}`}
                  {modalType === 'add' && 'Add New Integration'}
                </h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {modalType === 'configure' && selectedIntegration && (
                <div>
                  <p className="text-gray-600 mb-4">Configure {selectedIntegration.name}</p>
                  <form className="space-y-4">
                    <input
                      type="text"
                      placeholder="Connection string..."
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-md">
                        Cancel
                      </button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              )}
              
              {modalType === 'test' && selectedIntegration && (
                <div>
                  <p className="text-gray-600 mb-4">Test {selectedIntegration.name}</p>
                  <div className="flex justify-end gap-3">
                    <button onClick={closeModal} className="px-4 py-2 border rounded-md">Cancel</button>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-md">Run Test</button>
                  </div>
                </div>
              )}
              
              {modalType === 'add' && (
                <div>
                  <p className="text-gray-600 mb-4">Add a new integration</p>
                  <form className="space-y-4">
                    <select 
                      name="integration-type"
                      aria-label="Integration Type"
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Select type...</option>
                      <option value="golioth">Golioth IoT Platform</option>
                      <option value="azure-iot">Azure IoT Hub</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Integration name..."
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-md">
                        Cancel
                      </button>
                      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                        Add
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

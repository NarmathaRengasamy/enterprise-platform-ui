import React, { useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ConversationsPage from './pages/ConversationsPage';
import ProductsPage from './pages/ProductsPage';
import AddEditProductPage from './pages/AddEditProductPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CategoriesPage from './pages/CategoriesPage';
import SchedulePage from './pages/SchedulePage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import TeamsPage from './pages/TeamsPage';
import DeveloperPage from './pages/DeveloperPage';
import LoginPage from './pages/LoginPage';
import { INITIAL_PRODUCTS } from './data/mockData';
import { Product, ScheduleEvent } from './types';

export default function App(): JSX.Element {
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(INITIAL_PRODUCTS[0] as Product);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<ScheduleEvent | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <DashboardPage
            setActiveModule={setActiveModule}
            setSelectedProduct={setSelectedProduct}
            setSelectedScheduleEvent={setSelectedScheduleEvent}
            setSelectedConversationId={setSelectedConversationId}
          />
        );
      case 'conversations':
        return (
          <ConversationsPage
            selectedConversationId={selectedConversationId}
            setSelectedConversationId={setSelectedConversationId}
          />
        );
      case 'products':
        return (
          <ProductsPage
            setActiveModule={setActiveModule}
            setSelectedProduct={setSelectedProduct}
          />
        );
      case 'add-product':
        return (
          <AddEditProductPage
            setActiveModule={setActiveModule}
            selectedProduct={null}
            isEditing={false}
          />
        );
      case 'edit-product':
        return (
          <AddEditProductPage
            setActiveModule={setActiveModule}
            selectedProduct={selectedProduct}
            isEditing={true}
          />
        );
      case 'product-details':
        return (
          <ProductDetailsPage
            setActiveModule={setActiveModule}
            selectedProduct={selectedProduct}
          />
        );
      case 'categories':
        return <CategoriesPage setActiveModule={setActiveModule} />;
      case 'schedule':
      case 'calendar':
      case 'appointments':
        return (
          <SchedulePage
            selectedEvent={selectedScheduleEvent}
            setSelectedEvent={setSelectedScheduleEvent}
          />
        );
      case 'knowledge-base':
      case 'collections':
        return <KnowledgeBasePage />;
      case 'teams':
        return <TeamsPage />;
      case 'developer':
        return <DeveloperPage />;
      case 'login':
        return <LoginPage onLoginSuccess={() => setActiveModule('dashboard')} />;
      default:
        return (
          <DashboardPage
            setActiveModule={setActiveModule}
            setSelectedProduct={setSelectedProduct}
          />
        );
    }
  };

  return (
    <AppLayout
      activeModule={activeModule}
      setActiveModule={setActiveModule}
      onLogout={() => setIsAuthenticated(false)}
    >
      {renderActiveModule()}
    </AppLayout>
  );
}

import React, { useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import CallProvider from './components/calls/CallProvider';
import CallOverlay from './components/calls/CallOverlay';
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
import { authApi } from './api';
import { Product, ScheduleEvent } from './types';

export default function App(): JSX.Element {
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<ScheduleEvent | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  /* Set when the user jumps from a category to "View Products", so the product
     list opens already filtered to that category. */
  const [productCategoryId, setProductCategoryId] = useState<string | null>(null);
  /* A stored JWT survives a reload, so the session resumes without a re-login. */
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => authApi.isAuthenticated());

  const handleLogout = () => {
    authApi.logout();
    setIsAuthenticated(false);
    setActiveModule('dashboard');
  };

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
            initialCategoryId={productCategoryId}
            onCategoryFilterApplied={() => setProductCategoryId(null)}
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
        return (
          <CategoriesPage
            setActiveModule={setActiveModule}
            onViewCategoryProducts={(categoryId: string) => {
              setProductCategoryId(categoryId);
              setActiveModule('products');
            }}
          />
        );
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
    /* Around the whole app, not one page: an incoming call has to ring wherever
       the user is, and a live call must survive moving between pages — the
       WebRTC session dies with its provider. Mounted only once signed in. */
    <CallProvider>
      <AppLayout
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        onLogout={handleLogout}
      >
        {renderActiveModule()}
      </AppLayout>
      <CallOverlay />
    </CallProvider>
  );
}

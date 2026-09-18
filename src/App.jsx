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

export default function App() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const [selectedProduct, setSelectedProduct] = useState(INITIAL_PRODUCTS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

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
          />
        );
      case 'conversations':
        return <ConversationsPage />;
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
        return <SchedulePage />;
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

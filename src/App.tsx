import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
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
import SignupPage from './pages/SignupPage';
import { INITIAL_PRODUCTS } from './data/mockData';
import { Product, ScheduleEvent } from './types';

export default function App(): JSX.Element {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(INITIAL_PRODUCTS[0] as Product);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<ScheduleEvent | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  const handleSetActiveModule = (module: string) => {
    switch (module) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'conversations':
        navigate('/conversations');
        break;
      case 'products':
        navigate('/products');
        break;
      case 'add-product':
        navigate('/products/add');
        break;
      case 'edit-product':
        if (selectedProduct?.id) {
          navigate(`/products/${selectedProduct.id}/edit`);
        } else {
          navigate('/products/add');
        }
        break;
      case 'product-details':
        if (selectedProduct?.id) {
          navigate(`/products/${selectedProduct.id}`);
        } else {
          navigate('/products');
        }
        break;
      case 'categories':
        navigate('/categories');
        break;
      case 'schedule':
      case 'calendar':
      case 'appointments':
        navigate('/schedule');
        break;
      case 'knowledge-base':
      case 'collections':
        navigate('/knowledge-base');
        break;
      case 'teams':
        navigate('/teams');
        break;
      case 'developer':
        navigate('/developer');
        break;
      case 'login':
        navigate('/login');
        break;
      case 'signup':
        navigate('/signup');
        break;
      default:
        navigate(`/${module}`);
        break;
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <Routes>
      {/* Auth Routes */}
      <Route
        path="/login"
        element={<LoginPage onLoginSuccess={handleLoginSuccess} />}
      />
      <Route
        path="/signup"
        element={
          <SignupPage
            onSignupSuccess={handleLoginSuccess}
            onSwitchToLogin={() => navigate('/login')}
          />
        }
      />

      {/* Protected App Layout Routes */}
      <Route
        element={
          isAuthenticated ? (
            <AppLayout
              setActiveModule={handleSetActiveModule}
              onLogout={handleLogout}
            >
              <Outlet />
            </AppLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 1. Dashboard */}
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              setActiveModule={handleSetActiveModule}
              setSelectedProduct={setSelectedProduct}
              setSelectedScheduleEvent={setSelectedScheduleEvent}
              setSelectedConversationId={setSelectedConversationId}
            />
          }
        />

        {/* 2. Conversations */}
        <Route
          path="/conversations"
          element={
            <ConversationsPage
              selectedConversationId={selectedConversationId}
              setSelectedConversationId={setSelectedConversationId}
            />
          }
        />
        <Route
          path="/conversations/:conversationId"
          element={
            <ConversationsPage
              selectedConversationId={selectedConversationId}
              setSelectedConversationId={setSelectedConversationId}
            />
          }
        />

        {/* 3. Products & Catalog */}
        <Route
          path="/products"
          element={
            <ProductsPage
              setActiveModule={handleSetActiveModule}
              setSelectedProduct={setSelectedProduct}
            />
          }
        />
        <Route
          path="/products/add"
          element={
            <AddEditProductPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={null}
              isEditing={false}
            />
          }
        />
        <Route
          path="/products/new"
          element={
            <AddEditProductPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={null}
              isEditing={false}
            />
          }
        />
        <Route
          path="/products/:id/edit"
          element={
            <AddEditProductPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={selectedProduct}
              isEditing={true}
            />
          }
        />
        <Route
          path="/products/edit/:id"
          element={
            <AddEditProductPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={selectedProduct}
              isEditing={true}
            />
          }
        />
        <Route
          path="/products/edit"
          element={
            <AddEditProductPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={selectedProduct}
              isEditing={true}
            />
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProductDetailsPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
            />
          }
        />
        <Route
          path="/products/details/:id"
          element={
            <ProductDetailsPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
            />
          }
        />
        <Route
          path="/products/details"
          element={
            <ProductDetailsPage
              setActiveModule={handleSetActiveModule}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
            />
          }
        />

        {/* 4. Categories */}
        <Route
          path="/categories"
          element={<CategoriesPage setActiveModule={handleSetActiveModule} />}
        />

        {/* 5. Schedule & Calendar */}
        <Route
          path="/schedule"
          element={
            <SchedulePage
              selectedEvent={selectedScheduleEvent}
              setSelectedEvent={setSelectedScheduleEvent}
            />
          }
        />
        <Route
          path="/calendar"
          element={
            <SchedulePage
              selectedEvent={selectedScheduleEvent}
              setSelectedEvent={setSelectedScheduleEvent}
            />
          }
        />
        <Route
          path="/appointments"
          element={
            <SchedulePage
              selectedEvent={selectedScheduleEvent}
              setSelectedEvent={setSelectedScheduleEvent}
            />
          }
        />

        {/* 6. Knowledge Base */}
        <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="/collections" element={<KnowledgeBasePage />} />

        {/* 7. Teams */}
        <Route path="/teams" element={<TeamsPage />} />

        {/* 8. Developer */}
        <Route path="/developer" element={<DeveloperPage />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

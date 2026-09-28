import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { OperatorSessionProvider } from './context/OperatorContext';
import { useAuth } from './hooks/useAuth';
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
import CatalogSetupPage from './pages/catalog/CatalogSetupPage';
import CatalogCategoriesPage from './pages/catalog/CatalogCategoriesPage';
import CatalogProductsPage from './pages/catalog/CatalogProductsPage';
import CatalogProductEditPage from './pages/catalog/CatalogProductEditPage';
import CatalogProductDetailsPage from './pages/catalog/CatalogProductDetailsPage';
import CatalogChargesPage from './pages/catalog/CatalogChargesPage';
import CatalogBookingsPage from './pages/catalog/CatalogBookingsPage';
import CatalogStorefrontPage from './pages/catalog/CatalogStorefrontPage';
import StoreShell from './pages/store/StoreLayout';
import StoreLandingPage from './pages/store/StoreLandingPage';
import StoreProductsPage from './pages/store/StoreProductsPage';
import StoreProductPage from './pages/store/StoreProductPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import { Product, ScheduleEvent } from './types';

function AppRoutes(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedScheduleEvent, setSelectedScheduleEvent] = useState<ScheduleEvent | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

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
    navigate('/dashboard');
  };

  const handleLogout = () => {
    navigate('/login');
  };

  // Loading splash while checking session token
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white shadow-xl animate-pulse mb-4">
          <span className="material-symbols-outlined text-3xl">all_inclusive</span>
        </div>
        <div className="flex items-center gap-2.5 text-on-surface-variant font-label-md">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
          <span className="font-semibold text-sm">Loading OmniFlow Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth & Legal Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/signup"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <SignupPage
              onSignupSuccess={handleLoginSuccess}
              onSwitchToLogin={() => navigate('/login')}
            />
          )
        }
      />
      <Route
        path="/privacy"
        element={<SignupPage onSignupSuccess={handleLoginSuccess} onSwitchToLogin={() => navigate('/login')} />}
      />
      <Route
        path="/terms"
        element={<SignupPage onSignupSuccess={handleLoginSuccess} onSwitchToLogin={() => navigate('/login')} />}
      />
      <Route
        path="/help"
        element={<SignupPage onSignupSuccess={handleLoginSuccess} onSwitchToLogin={() => navigate('/login')} />}
      />
      <Route
        path="/support"
        element={<SignupPage onSignupSuccess={handleLoginSuccess} onSwitchToLogin={() => navigate('/login')} />}
      />

      {/* Customer-facing shop.
           Declared before the protected tree and with no auth check at all —
           a shopper has no account, and these routes must render for someone
           who has never logged in. */}
      <Route path="/store" element={<StoreShell />}>
        <Route index element={<StoreLandingPage />} />
        <Route path="products" element={<StoreProductsPage />} />
        <Route path="product/:productId" element={<StoreProductPage />} />
      </Route>

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

        {/* 9. Catalogue v2 — the configurable catalogue.
             Its own routes rather than replacing /products, so the existing
             v1 screens keep working throughout the cutover. */}
        <Route path="/catalog" element={<Navigate to="/catalog/products" replace />} />
        <Route path="/catalog/setup" element={<CatalogSetupPage />} />
        <Route path="/catalog/categories" element={<CatalogCategoriesPage />} />
        <Route path="/catalog/products" element={<CatalogProductsPage />} />
        <Route path="/catalog/products/new" element={<CatalogProductEditPage />} />
        <Route path="/catalog/products/:productId" element={<CatalogProductDetailsPage />} />
        <Route path="/catalog/products/:productId/edit" element={<CatalogProductEditPage />} />
        <Route path="/catalog/charges" element={<CatalogChargesPage />} />
        <Route path="/catalog/bookings" element={<CatalogBookingsPage />} />
        <Route path="/catalog/storefront" element={<CatalogStorefrontPage />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      {/* Around the WHOLE app, not one page: an incoming call has to ring
          wherever the operator is, and a live call dies with its provider — so
          unmounting this on navigation would hang up the call. */}
      <OperatorSessionProvider>
        <AppRoutes />
      </OperatorSessionProvider>
    </AuthProvider>
  );
}

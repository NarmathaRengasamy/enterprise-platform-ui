import React, { useState } from 'react';
import { Button, Icon } from './index';

export type LegalModalTab = 'privacy' | 'terms' | 'help';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: LegalModalTab;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalModalTab>(initialTab);

  // Update active tab if initialTab changes
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-on-surface">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-2xl">
                {activeTab === 'privacy' ? 'policy' : activeTab === 'terms' ? 'gavel' : 'contact_support'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">
                {activeTab === 'privacy'
                  ? 'Privacy Policy'
                  : activeTab === 'terms'
                  ? 'Terms of Service'
                  : 'Help & Enterprise Support'}
              </h2>
              <p className="text-xs text-on-surface-variant">
                OmniFlow Perfox Enterprise Platform • Last updated September 2026
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-outline hover:text-on-surface rounded-xl hover:bg-surface-container-high transition-colors"
            aria-label="Close modal"
          >
            <Icon name="close" size="md" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-surface-container bg-surface-container-lowest text-xs font-semibold">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">policy</span>
            <span>Privacy Policy</span>
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            <span>Terms of Service</span>
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'help'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">support_agent</span>
            <span>Help &amp; Support</span>
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-6 overflow-y-auto font-body-md text-sm leading-relaxed text-on-surface-variant space-y-5">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">1. Information We Collect</h3>
                <p>
                  We collect information necessary to provide and secure our enterprise AI operations platform. This includes:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                  <li><strong>Account Credentials:</strong> Name, work email address, department, assigned role, and hashed passwords.</li>
                  <li><strong>Integration Data:</strong> Metadata from connected platforms including Calendly scheduling endpoints, webhooks, and AI agent logs.</li>
                  <li><strong>Usage Metrics:</strong> Session duration, API call telemetry, and audit logs for enterprise compliance.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">2. How We Use &amp; Protect Data</h3>
                <p>
                  Data is processed strictly to provide automated conversational AI, scheduling synchronization, and product management. All data is encrypted in transit via TLS 1.3 and at rest using AES-256 encryption.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">3. GDPR &amp; CCPA Compliance</h3>
                <p>
                  You retain full ownership and control over your enterprise data. You may request data export, modification, or deletion at any time by contacting our security compliance team at <span className="text-primary font-medium">privacy@perfox.ai</span>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">1. Acceptance of Terms</h3>
                <p>
                  By creating an account or accessing the OmniFlow Perfox Enterprise Platform, you agree to comply with these terms, our acceptable use policies, and applicable data protection regulations.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">2. User Accounts &amp; Security</h3>
                <p>
                  You are responsible for maintaining the confidentiality of your credentials. You must use strong password complexity and notify administrators immediately upon discovering unauthorized access.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">3. Service Level &amp; Enterprise SLA</h3>
                <p>
                  OmniFlow provides 99.9% uptime for enterprise tiers. Scheduled maintenance is announced 48 hours in advance via our status portal.
                </p>
              </div>

              <div>
                <h3 className="text-base font-bold text-on-surface mb-1">4. Intellectual Property</h3>
                <p>
                  All proprietary AI models, platform UI, APIs, and workflows remain the intellectual property of Skillmine &amp; Perfox Technologies.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>24/7 Enterprise Support Available</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Our dedicated engineering and technical specialists are ready to assist with deployment, API integrations, and troubleshooting.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high">
                  <div className="flex items-center gap-2 text-on-surface font-semibold text-xs mb-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">mail</span>
                    <span>Technical Support Email</span>
                  </div>
                  <p className="text-xs text-primary font-mono">support@perfox.ai</p>
                  <p className="text-[11px] text-outline mt-1">Average response time: &lt; 15 mins</p>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high">
                  <div className="flex items-center gap-2 text-on-surface font-semibold text-xs mb-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">menu_book</span>
                    <span>Documentation &amp; API Portal</span>
                  </div>
                  <p className="text-xs text-primary font-mono">http://localhost:5050/api/docs</p>
                  <p className="text-[11px] text-outline mt-1">Interactive OpenAPI Swagger UI</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-on-surface text-xs mb-2">Frequently Asked Questions:</h4>
                <div className="space-y-2 text-xs">
                  <details className="p-2.5 bg-surface-container-low rounded-lg border border-surface-container cursor-pointer">
                    <summary className="font-semibold text-on-surface">How do I connect my Calendly account?</summary>
                    <p className="mt-1.5 text-on-surface-variant">
                      Navigate to the Schedule page, click &ldquo;Calendly Booking&rdquo;, and paste your Calendly URL or Personal Access Token in the Settings bar.
                    </p>
                  </details>
                  <details className="p-2.5 bg-surface-container-low rounded-lg border border-surface-container cursor-pointer">
                    <summary className="font-semibold text-on-surface">How do I reset my password?</summary>
                    <p className="mt-1.5 text-on-surface-variant">
                      Contact your organization administrator or reach out to <span className="text-primary font-medium">support@perfox.ai</span> for an instant password reset token.
                    </p>
                  </details>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-surface-container-high flex items-center justify-between bg-surface-container-low/40 text-xs">
          <span className="text-outline text-[11px]">
            Skillmine Technologies Enterprise Suite
          </span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Got it, Close
          </Button>
        </div>
      </div>
    </div>
  );
};

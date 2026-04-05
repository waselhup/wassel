import { useState, useEffect } from 'react';
import { useSearch } from 'wouter';

type StepStatus = 'complete' | 'current' | 'pending';

interface Step {
    id: number;
    title: string;
    description: string;
    status: StepStatus;
    icon: string;
    action?: () => void;
    actionLabel?: string;
    detail?: string;
}

export default function Connected() {
    const search = useSearch();
    const params = new URLSearchParams(search);
    const error = params.get('error');
    const clientId = params.get('client_id');

    const [currentStep, setCurrentStep] = useState(error ? 0 : 2);
    const [extensionInstalled, setExtensionInstalled] = useState(false);
    const [importCount, setImportCount] = useState(0);
    const [checking, setChecking] = useState(false);

    // Check for extension installation
    const checkExtension = () => {
        // The extension sets a marker in the DOM or we check via a message
        const marker = document.getElementById('wassel-extension-marker');
        if (marker) {
            setExtensionInstalled(true);
            setCurrentStep(3);
        }
    };

    // Check import status
    const checkImports = async () => {
        setChecking(true);
        try {
            const token = localStorage.getItem('supabase_token');
            if (!token || !clientId) {
                setChecking(false);
                return;
            }
            const res = await fetch(`/api/ext/prospects?client_id=${clientId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setImportCount(data.count || 0);
                if (data.count > 0) {
                    setCurrentStep(5);
                }
            }
        } catch {
            // Ignore
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        checkExtension();
        const interval = setInterval(checkExtension, 3000);
        return () => clearInterval(interval);
    }, []);

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.errorIcon}>✕</div>
                    <h1 style={styles.errorTitle}>Connection Failed</h1>
                    <p style={styles.errorText}>
                        {error === 'denied'
                            ? 'You declined the LinkedIn permission request.'
                            : 'Something went wrong during the LinkedIn connection.'}
                    </p>
                    <p style={styles.subtitle}>Don't worry — you can try again using the link from your invite email.</p>
                    <a href="/" style={styles.primaryButton}>Back to Home</a>
                </div>
            </div>
        );
    }

    const getStepStatus = (stepNum: number): StepStatus => {
        if (stepNum < currentStep) return 'complete';
        if (stepNum === currentStep) return 'current';
        return 'pending';
    };

    const steps: Step[] = [
        {
            id: 1,
            title: 'LinkedIn Connected',
            description: 'Your LinkedIn account is now linked to Wassel.',
            status: getStepStatus(1),
            icon: '🔗',
            detail: 'Profile access granted securely via OAuth.',
        },
        {
            id: 2,
            title: 'Install Chrome Extension',
            description: 'Install the Wassel extension to import prospects from LinkedIn.',
            status: getStepStatus(2),
            icon: '📦',
            action: () => window.location.href = '/extension',
            actionLabel: 'Download & Install Extension',
        },
        {
            id: 3,
            title: 'Open LinkedIn Search',
            description: 'Search for prospects on LinkedIn. The extension will appear on the page.',
            status: getStepStatus(3),
            icon: '🔍',
            action: () => window.open('https://www.linkedin.com/search/results/people/', '_blank'),
            actionLabel: 'Open LinkedIn Search ↗',
        },
        {
            id: 4,
            title: 'Import Prospects',
            description: 'Use the extension sidebar on LinkedIn to import visible search results.',
            status: getStepStatus(4),
            icon: '📥',
            action: checkImports,
            actionLabel: checking ? 'Checking...' : 'Check Import Status',
        },
        {
            id: 5,
            title: 'View in Wassel Dashboard',
            description: `${importCount > 0 ? `${importCount} prospects imported!` : 'Verify imported prospects in your dashboard.'}`,
            status: getStepStatus(5),
            icon: '✅',
            action: () => window.location.href = '/dashboard',
            actionLabel: 'Go to Dashboard →',
        },
    ];

    return (
        <div style={styles.container}>
            <div style={styles.wrapper}>
                {/* Success Header */}
                <div style={styles.successHeader}>
                    <div style={styles.successBadge}>
                        <span style={styles.successCheckmark}>✓</span>
                    </div>
                    <h1 style={styles.title}>LinkedIn Connected Successfully!</h1>
                    <p style={styles.subtitle}>
                        Follow the steps below to start importing prospects into your campaigns.
                    </p>
                </div>

                {/* Stepper */}
                <div style={styles.stepperContainer}>
                    {steps.map((step, index) => (
                        <div key={step.id} style={styles.stepWrapper}>
                            {/* Connector line */}
                            {index > 0 && (
                                <div style={{
                                    ...styles.connector,
                                    backgroundColor: step.status === 'complete' || step.status === 'current' ? '#2563eb' : '#e5e7eb',
                                }} />
                            )}

                            {/* Step card */}
                            <div style={{
                                ...styles.stepCard,
                                borderColor: step.status === 'current' ? '#8B5CF6' : step.status === 'complete' ? '#34d399' : 'rgba(255,255,255,0.1)',
                                backgroundColor: step.status === 'current' ? 'rgba(139,92,246,0.08)' : step.status === 'complete' ? 'rgba(34,197,94,0.08)' : 'rgba(30,41,59,0.5)',
                            }}>
                                <div style={styles.stepHeader}>
                                    <div style={{
                                        ...styles.stepNumber,
                                        backgroundColor: step.status === 'complete' ? '#34d399' : step.status === 'current' ? '#8B5CF6' : 'rgba(255,255,255,0.2)',
                                    }}>
                                        {step.status === 'complete' ? '✓' : step.id}
                                    </div>
                                    <div style={styles.stepInfo}>
                                        <div style={styles.stepTitle}>
                                            <span style={styles.stepIcon}>{step.icon}</span>
                                            {step.title}
                                            {step.status === 'complete' && <span style={styles.doneLabel}>Done</span>}
                                            {step.status === 'current' && <span style={styles.currentLabel}>Current</span>}
                                        </div>
                                        <p style={styles.stepDescription}>{step.description}</p>
                                        {step.detail && step.status === 'complete' && (
                                            <p style={styles.stepDetail}>{step.detail}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Action button */}
                                {step.action && step.status === 'current' && (
                                    <button
                                        onClick={step.action}
                                        disabled={checking}
                                        style={{
                                            ...styles.stepButton,
                                            opacity: checking ? 0.7 : 1,
                                        }}
                                    >
                                        {step.actionLabel}
                                    </button>
                                )}

                                {/* Show action for completed final step */}
                                {step.id === 5 && step.status === 'current' && step.action && (
                                    <button onClick={step.action} style={styles.stepButton}>
                                        {step.actionLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Help text */}
                <div style={styles.helpSection}>
                    <p style={styles.helpText}>
                        💡 <strong>Tip:</strong> You can skip ahead — install the extension and start importing right away!
                    </p>
                    <div style={styles.skipButtons}>
                        <button onClick={() => setCurrentStep(2)} style={styles.skipLink}>Install Extension</button>
                        <span style={styles.separator}>·</span>
                        <button onClick={() => window.open('https://www.linkedin.com/search/results/people/', '_blank')} style={styles.skipLink}>Open LinkedIn</button>
                        <span style={styles.separator}>·</span>
                        <a href="/dashboard" style={styles.skipLink}>Go to Dashboard</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.08) 100%)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    wrapper: {
        maxWidth: '640px',
        width: '100%',
    },
    successHeader: {
        textAlign: 'center' as const,
        marginBottom: '32px',
    },
    successBadge: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #34d399, #10b981)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px auto',
        boxShadow: '0 4px 20px rgba(52, 211, 153, 0.3)',
    },
    successCheckmark: {
        color: '#fff',
        fontSize: '32px',
        fontWeight: 'bold',
    },
    title: {
        fontSize: '28px',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.9)',
        margin: '0 0 8px 0',
    },
    subtitle: {
        fontSize: '16px',
        color: 'rgba(255,255,255,0.7)',
        margin: '0',
        lineHeight: '1.5',
    },
    stepperContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0px',
    },
    stepWrapper: {
        position: 'relative' as const,
    },
    connector: {
        position: 'absolute' as const,
        left: '27px',
        top: '-16px',
        width: '3px',
        height: '16px',
        borderRadius: '2px',
    },
    stepCard: {
        border: '2px solid',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '16px',
        transition: 'all 0.2s ease',
        background: 'rgba(30, 41, 59, 0.5)',
    },
    stepHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
    },
    stepNumber: {
        width: '36px',
        height: '36px',
        minWidth: '36px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: '700',
        fontSize: '14px',
    },
    stepInfo: {
        flex: 1,
    },
    stepTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
    },
    stepIcon: {
        fontSize: '18px',
    },
    stepDescription: {
        fontSize: '14px',
        color: 'rgba(255,255,255,0.6)',
        margin: '0',
        lineHeight: '1.4',
    },
    stepDetail: {
        fontSize: '12px',
        color: '#34d399',
        margin: '4px 0 0 0',
        fontStyle: 'italic',
    },
    doneLabel: {
        fontSize: '11px',
        fontWeight: '600',
        color: '#34d399',
        backgroundColor: 'rgba(34,197,94,0.15)',
        padding: '2px 8px',
        borderRadius: '10px',
    },
    currentLabel: {
        fontSize: '11px',
        fontWeight: '600',
        color: '#a78bfa',
        backgroundColor: 'rgba(139,92,246,0.15)',
        padding: '2px 8px',
        borderRadius: '10px',
    },
    stepButton: {
        marginTop: '12px',
        marginLeft: '52px',
        padding: '10px 20px',
        backgroundColor: '#8B5CF6',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    helpSection: {
        textAlign: 'center' as const,
        marginTop: '24px',
        padding: '20px',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
    },
    helpText: {
        fontSize: '14px',
        color: 'rgba(255,255,255,0.6)',
        margin: '0 0 12px 0',
    },
    skipButtons: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
    },
    skipLink: {
        color: '#a78bfa',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: '500',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '0',
    },
    separator: {
        color: 'rgba(255,255,255,0.2)',
    },
    card: {
        maxWidth: '480px',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '16px',
        padding: '48px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        textAlign: 'center' as const,
        margin: '60px auto',
        border: '1px solid rgba(255,255,255,0.1)',
    },
    errorIcon: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(239,68,68,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px auto',
        fontSize: '28px',
        color: '#ef4444',
        fontWeight: 'bold',
    },
    errorTitle: {
        fontSize: '24px',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.9)',
        margin: '0 0 8px 0',
    },
    errorText: {
        fontSize: '16px',
        color: 'rgba(255,255,255,0.6)',
        margin: '0 0 8px 0',
    },
    primaryButton: {
        display: 'inline-block',
        marginTop: '20px',
        padding: '12px 24px',
        backgroundColor: '#8B5CF6',
        color: '#fff',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: '600',
        fontSize: '14px',
    },
};

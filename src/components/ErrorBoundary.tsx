'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    level?: 'root' | 'route' | 'component';
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Prevents entire app from crashing due to unhandled errors
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Call optional error handler
        this.props.onError?.(error, errorInfo);

        // TODO: Log to error tracking service (e.g., Sentry)
        // Sentry.captureException(error, { extra: errorInfo });

        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI based on level
            const level = this.props.level || 'component';

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
                    <Card className="max-w-2xl w-full border-destructive/50">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                            </div>
                            <CardTitle className="text-2xl">
                                {level === 'root' ? 'Application Error' : 'Something Went Wrong'}
                            </CardTitle>
                            <CardDescription>
                                {level === 'root'
                                    ? 'The application encountered an unexpected error. Please try refreshing the page.'
                                    : 'This section encountered an error. You can try again or return to the home page.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Error Details (only in development) */}
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="rounded-lg bg-muted p-4 space-y-2">
                                    <p className="font-mono text-xs font-semibold text-destructive">
                                        {this.state.error.toString()}
                                    </p>
                                    {this.state.errorInfo && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                                                Component Stack
                                            </summary>
                                            <pre className="mt-2 text-[10px] overflow-auto max-h-40 text-muted-foreground">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                {level !== 'root' && (
                                    <Button
                                        onClick={this.handleReset}
                                        variant="default"
                                        className="flex-1"
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Try Again
                                    </Button>
                                )}
                                <Button
                                    onClick={this.handleReload}
                                    variant={level === 'root' ? 'default' : 'outline'}
                                    className="flex-1"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Reload Page
                                </Button>
                                {level !== 'root' && (
                                    <Button
                                        onClick={this.handleGoHome}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        <Home className="mr-2 h-4 w-4" />
                                        Go Home
                                    </Button>
                                )}
                            </div>

                            {/* Removed offline banner - will be handled separately */}
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Convenience wrapper for route-level error boundaries
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary level="route">
            {children}
        </ErrorBoundary>
    );
}

/**
 * Convenience wrapper for component-level error boundaries
 */
export function ComponentErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary level="component">
            {children}
        </ErrorBoundary>
    );
}

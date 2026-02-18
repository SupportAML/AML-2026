import React, { useState, useEffect } from 'react';
import {
    UserCheckIcon,
    UserXIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    Loader2Icon,
    AlertCircleIcon
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { PendingSignupRequest } from '../types';
import { approveSignupRequest, denySignupRequest } from '../services/authService';
import { sendApprovalEmail, sendDenialEmail } from '../services/emailService';

interface SignupRequestsPanelProps {
    currentUserUid: string;
}

export const SignupRequestsPanel: React.FC<SignupRequestsPanelProps> = ({ currentUserUid }) => {
    const [pendingRequests, setPendingRequests] = useState<PendingSignupRequest[]>([]);
    const [reviewedRequests, setReviewedRequests] = useState<PendingSignupRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [denialReason, setDenialReason] = useState('');
    const [denyingId, setDenyingId] = useState<string | null>(null);

    useEffect(() => {
        // Subscribe to pending requests
        // NOTE: Removed orderBy to avoid needing composite index. Sorting done in JS.
        const pendingQuery = query(
            collection(db, 'pendingSignupRequests'),
            where('status', '==', 'pending')
        );

        const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            } as PendingSignupRequest));

            // Sort by requestedAt descending (newest first)
            requests.sort((a, b) =>
                new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
            );

            setPendingRequests(requests);
            setLoading(false);
        }, (error) => {
            console.error('Error loading pending requests:', error);
            setLoading(false);
        });

        // Subscribe to reviewed requests (last 10)
        // NOTE: Removed orderBy to avoid needing composite index. Sorting done in JS.
        const reviewedQuery = query(
            collection(db, 'pendingSignupRequests'),
            where('status', 'in', ['approved', 'denied'])
        );

        const unsubReviewed = onSnapshot(reviewedQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            } as PendingSignupRequest));

            // Sort by reviewedAt descending (newest first)
            requests.sort((a, b) => {
                const dateA = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
                const dateB = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
                return dateB - dateA;
            });

            // Take only the last 10
            setReviewedRequests(requests.slice(0, 10));
        });

        return () => {
            unsubPending();
            unsubReviewed();
        };
    }, []);

    const handleApprove = async (request: PendingSignupRequest) => {
        setProcessingId(request.id);
        try {
            const result = await approveSignupRequest(request.id, currentUserUid);

            if (result.success) {
                // Send approval email
                try {
                    await sendApprovalEmail(request.email, request.name);
                } catch (emailError) {
                    console.error('Failed to send approval email:', emailError);
                    // Continue anyway - user is approved
                }
            } else {
                alert(`Failed to approve request: ${result.error}`);
            }
        } catch (error) {
            console.error('Error approving request:', error);
            alert('Failed to approve request. Please try again.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeny = async (request: PendingSignupRequest) => {
        if (!denialReason.trim()) {
            alert('Please provide a reason for denial');
            return;
        }

        setProcessingId(request.id);
        try {
            const result = await denySignupRequest(request.id, currentUserUid, denialReason);

            if (result.success) {
                // Send denial email
                try {
                    await sendDenialEmail(request.email, request.name, denialReason);
                } catch (emailError) {
                    console.error('Failed to send denial email:', emailError);
                }

                setDenyingId(null);
                setDenialReason('');
            } else {
                alert(`Failed to deny request: ${result.error}`);
            }
        } catch (error) {
            console.error('Error denying request:', error);
            alert('Failed to deny request. Please try again.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2Icon className="w-8 h-8 text-cyan-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Pending Requests Section */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <ClockIcon className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Pending Access Requests</h3>
                                <p className="text-sm text-slate-500">Review and approve new user signups</p>
                            </div>
                        </div>
                        {pendingRequests.length > 0 && (
                            <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                                {pendingRequests.length}
                            </div>
                        )}
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {pendingRequests.length === 0 ? (
                        <div className="p-12 text-center">
                            <CheckCircleIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">No pending requests</p>
                            <p className="text-sm text-slate-400 mt-1">All signup requests have been reviewed</p>
                        </div>
                    ) : (
                        pendingRequests.map(request => (
                            <div key={request.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold">
                                                {request.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 className="text-base font-bold text-slate-900">{request.name}</h4>
                                                <p className="text-sm text-slate-500">{request.email}</p>
                                            </div>
                                        </div>
                                        <div className="ml-13 space-y-1">
                                            <p className="text-xs text-slate-400">
                                                <span className="font-semibold">Requested:</span>{' '}
                                                {new Date(request.requestedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
                                            </p>
                                            {request.ipAddress && (
                                                <p className="text-xs text-slate-400">
                                                    <span className="font-semibold">IP:</span> {request.ipAddress}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {denyingId === request.id ? (
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-80">
                                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                                    Reason for Denial
                                                </label>
                                                <textarea
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                                    rows={3}
                                                    placeholder="e.g., Not affiliated with our organization"
                                                    value={denialReason}
                                                    onChange={(e) => setDenialReason(e.target.value)}
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleDeny(request)}
                                                        disabled={processingId === request.id || !denialReason.trim()}
                                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {processingId === request.id ? (
                                                            <Loader2Icon className="w-4 h-4 animate-spin mx-auto" />
                                                        ) : (
                                                            'Confirm Denial'
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDenyingId(null);
                                                            setDenialReason('');
                                                        }}
                                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300 transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(request)}
                                                    disabled={processingId === request.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingId === request.id ? (
                                                        <Loader2Icon className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <UserCheckIcon className="w-4 h-4" />
                                                    )}
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => setDenyingId(request.id)}
                                                    disabled={processingId === request.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <UserXIcon className="w-4 h-4" />
                                                    Deny
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Recent Activity Section */}
            {reviewedRequests.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                <AlertCircleIcon className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                                <p className="text-sm text-slate-500">Last 10 reviewed requests</p>
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {reviewedRequests.map(request => (
                            <div key={request.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${request.status === 'approved'
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-red-100 text-red-600'
                                        }`}>
                                        {request.status === 'approved' ? (
                                            <CheckCircleIcon className="w-4 h-4" />
                                        ) : (
                                            <XCircleIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{request.name}</p>
                                        <p className="text-xs text-slate-500">{request.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs font-bold uppercase tracking-wider ${request.status === 'approved' ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                        {request.status}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {request.reviewedAt && new Date(request.reviewedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

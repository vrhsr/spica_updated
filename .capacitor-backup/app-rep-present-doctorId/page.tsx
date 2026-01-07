import PresentationViewerClient from './PresentationViewerClient';

// Required for static export - doctor IDs are dynamic at runtime
// This allows the route to work with client-side navigation
export function generateStaticParams() {
    return [];
}

// Allow dynamic routes at runtime
export const dynamicParams = true;

export default function PresentationViewerPage({ params }: { params: { doctorId: string } }) {
    return <PresentationViewerClient doctorId={params.doctorId} />;
}

import PresentationViewerClient from './PresentationViewerClient';

// Force dynamic rendering - this route cannot be pre-generated
// as doctor IDs are determined at runtime from Firestore
export const dynamic = 'force-dynamic';

export default function PresentationViewerPage({ params }: { params: { doctorId: string } }) {
    return <PresentationViewerClient doctorId={params.doctorId} />;
}

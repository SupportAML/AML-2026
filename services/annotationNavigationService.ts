
import { Annotation, ViewMode } from '../types';

export interface NavigationState {
    viewMode: ViewMode;
    activeDocId: string | null;
    initialPage: number;
    focusedAnnotationId: string | null;
    isEditing: boolean;
}

/**
 * Service to handle complex navigation and focus logic for annotations
 */
export const annotationNavigationService = {
    /**
     * Generates the state needed to navigate to a specific annotation and focus it
     */
    getNavigationFocusState: (annotation: Annotation, editMode: boolean = false): Partial<NavigationState> => {
        return {
            viewMode: ViewMode.DOC_VIEWER,
            activeDocId: annotation.documentId,
            initialPage: annotation.page,
            focusedAnnotationId: annotation.id,
            isEditing: editMode
        };
    }
};

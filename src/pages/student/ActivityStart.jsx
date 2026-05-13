import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ARApp from '../ar/ARApp';
import { DEFAULT_ALLOWED_OBJECT_IDS } from '../../utils/activityArConfig';

// ActivityStart launches the full AR experience
const ActivityStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const viewMode = location.state?.viewMode === true || location.state?.mode === 'view';
  const artworkUrl = location.state?.artworkUrl;
  const arInstructions = typeof location.state?.arInstructions === 'string'
    ? location.state.arInstructions
    : '';
  const initialPaintState = Array.isArray(location.state?.paintState) ? location.state.paintState : [];
  const initialSceneState = Array.isArray(location.state?.sceneState) ? location.state.sceneState : [];
  const initialPuzzleState = Array.isArray(location.state?.puzzleState) ? location.state.puzzleState : [];
  const requestedPuzzlePieces = Number(location.state?.puzzlePieces || 0);
  const puzzlePieces = requestedPuzzlePieces === 3 || requestedPuzzlePieces === 4 ? requestedPuzzlePieces : 0;
  const allowedObjectIds = Array.isArray(location.state?.allowedObjectIds) && location.state.allowedObjectIds.length > 0
    ? location.state.allowedObjectIds
    : [...DEFAULT_ALLOWED_OBJECT_IDS];
  const modelUrl = typeof location.state?.modelUrl === 'string' && location.state.modelUrl.trim()
    ? location.state.modelUrl
    : undefined;
  const modelFileType = typeof location.state?.modelFileType === 'string' && location.state.modelFileType.trim()
    ? location.state.modelFileType.trim().toLowerCase()
    : undefined;
  const modelConfigs = Array.isArray(location.state?.modelConfigs)
    ? location.state.modelConfigs
        .filter((model) => typeof model?.modelUrl === 'string' && model.modelUrl.trim())
        .map((model, index) => ({
          id: model.id || `model-${index}`,
          label: model.label || `Model ${index + 1}`,
          modelUrl: model.modelUrl,
          modelFileType: typeof model.modelFileType === 'string' ? model.modelFileType.trim().toLowerCase() : undefined,
        }))
    : [];
  const userInfo = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('userInfo') || '{}');
    } catch {
      return {};
    }
  }, []);

  return (
    <ARApp
      key={location.key}
      activityId={id}
      studentId={userInfo.id}
      viewMode={viewMode ? 'view' : 'edit'}
      artworkUrl={artworkUrl}
      arInstructions={arInstructions}
      initialPaintState={initialPaintState}
      initialSceneState={initialSceneState}
      initialPuzzleState={initialPuzzleState}
      allowedObjectIds={allowedObjectIds}
      modelUrl={modelUrl}
      modelFileType={modelFileType}
      modelConfigs={modelConfigs}
      puzzlePieces={puzzlePieces}
      onExit={() => navigate(-1)}
    />
  );
};

export default ActivityStart;

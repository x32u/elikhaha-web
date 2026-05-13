import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ARApp from '../ar/ARApp';
import { DEFAULT_ALLOWED_OBJECT_IDS } from '../../utils/activityArConfig';
import { getActivityDetails } from '../../services/studentApi';

// ActivityStart launches the full AR experience
const ActivityStart = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryStudentId = query.get('studentId') || '';
  const state = location.state || {};
  const [directActivity, setDirectActivity] = useState(null);
  const [loadingDirectActivity, setLoadingDirectActivity] = useState(false);
  const [directActivityError, setDirectActivityError] = useState('');

  const userInfo = useMemo(() => {
    let stored = {};
    try {
      stored = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
    } catch {
      stored = {};
    }
    return {
      ...stored,
      id: stored.id || queryStudentId,
    };
  }, [queryStudentId]);

  const shouldLoadDirectActivity = !location.state && Boolean(id && userInfo.id);

  useEffect(() => {
    let cancelled = false;
    if (!shouldLoadDirectActivity) return undefined;

    const loadActivity = async () => {
      setLoadingDirectActivity(true);
      setDirectActivityError('');
      const result = await getActivityDetails(id, userInfo.id);
      if (cancelled) return;
      if (result.success) {
        setDirectActivity(result.data || null);
      } else {
        setDirectActivityError(result.error || 'Unable to load AR activity.');
      }
      setLoadingDirectActivity(false);
    };

    loadActivity();
    return () => {
      cancelled = true;
    };
  }, [id, shouldLoadDirectActivity, userInfo.id]);

  const source = location.state ? state : directActivity || {};
  const viewMode = state.viewMode === true || state.mode === 'view' || query.get('mode') === 'view';
  const artworkUrl = state.artworkUrl || source.artwork_url;
  const arInstructions = typeof source.arInstructions === 'string'
    ? source.arInstructions
    : typeof source.ar_instructions === 'string'
      ? source.ar_instructions
      : '';
  const initialPaintState = Array.isArray(source.paintState)
    ? source.paintState
    : Array.isArray(source.paint_state)
      ? source.paint_state
      : [];
  const initialSceneState = Array.isArray(source.sceneState)
    ? source.sceneState
    : Array.isArray(source.scene_state)
      ? source.scene_state
      : [];
  const initialPuzzleState = Array.isArray(source.puzzleState)
    ? source.puzzleState
    : Array.isArray(source.puzzle_state)
      ? source.puzzle_state
      : [];
  const requestedPuzzlePieces = Number(source.puzzlePieces || source.puzzle_pieces || 0);
  const puzzlePieces = requestedPuzzlePieces === 3 || requestedPuzzlePieces === 4 ? requestedPuzzlePieces : 0;
  const allowedObjectIds = Array.isArray(source.allowedObjectIds) && source.allowedObjectIds.length > 0
    ? source.allowedObjectIds
    : Array.isArray(source.allowed_object_ids) && source.allowed_object_ids.length > 0
      ? source.allowed_object_ids
      : [...DEFAULT_ALLOWED_OBJECT_IDS];
  const rawModelUrl = source.modelUrl || source.model_url;
  const modelUrl = typeof rawModelUrl === 'string' && rawModelUrl.trim() ? rawModelUrl : undefined;
  const rawModelFileType = source.modelFileType || source.model_file_type;
  const modelFileType = typeof rawModelFileType === 'string' && rawModelFileType.trim()
    ? rawModelFileType.trim().toLowerCase()
    : undefined;
  const rawModelConfigs = Array.isArray(source.modelConfigs)
    ? source.modelConfigs
    : Array.isArray(source.model_configs)
      ? source.model_configs
      : [];
  const modelConfigs = rawModelConfigs
    .filter((model) => typeof model?.modelUrl === 'string' && model.modelUrl.trim())
    .map((model, index) => ({
      id: model.id || `model-${index}`,
      label: model.label || `Model ${index + 1}`,
      modelUrl: model.modelUrl,
      modelFileType: typeof model.modelFileType === 'string' ? model.modelFileType.trim().toLowerCase() : undefined,
    }));

  const notifyMobile = (type) => {
    try {
      window.ElikhaMobile?.postMessage(JSON.stringify({ type, activityId: id }));
    } catch {
      // Ignore when not running inside the Flutter WebView.
    }
  };

  if (loadingDirectActivity) {
    return <div style={{ padding: 24, fontWeight: 700 }}>Loading AR activity...</div>;
  }

  if (directActivityError) {
    return <div style={{ padding: 24, color: '#b42318', fontWeight: 700 }}>{directActivityError}</div>;
  }

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
      onExit={(reason) => {
        notifyMobile(reason === 'submitted' ? 'submitted' : 'exit');
        navigate(-1);
      }}
    />
  );
};

export default ActivityStart;

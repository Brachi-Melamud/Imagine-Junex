import React, { useCallback, useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { MusicalHelper } from '../../services/musicalHelper';

import { Note } from '../../model/note';
import { Score } from '../../model/score';
import { MusicModel, ScoreModel } from '../../model/scoreModel';

// components
import { StageUI } from './StageUI';
import { NotePanel } from './NotePanel';
import { PartsPanel } from './PartsPanel';
import { PlayerPanel } from './PlayerPanel';
import { MeasurePanel } from './MeasurePanel';
import { Piano } from '../../components/Piano';
import { ComposerToolbar } from './ComposerToolbar';
import { BoomWhacker } from '../../components/BoomWhacker';

// recoil state management
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectionAtom } from '../../atoms/selectionAtom';
import { diskSaveTimeAtom } from '../../atoms/diskSaveTimeAtom';
import { copiedMeasureIdAtom } from '../../atoms/copiedMeasureIdAtom';

export const ComposerPage = () => {
	const useStyles = makeStyles(() => ({
		root: {
			position: 'relative',
			height: '100%',
			userSelect: 'none',
		},
		toolbarContainer: {
			position: 'fixed',
			top: 84,
			left: 32,
			'@media print': {
				display: 'none',
			},
		},
		stageContainer: {
			position: 'relative',
			height: '100%',
			transform: 'translate(0, 0)',
		},
		pianoAnchor: {
			position: 'absolute',
			left: 800,
			top: 0,
			'@media print': {
				display: 'none',
			},
		},
		notePanelAnchor: {
			position: 'absolute',
			left: 800,
			top: 181,
			'@media print': {
				display: 'none',
			},
		},
		measurePanelAnchor: {
			position: 'absolute',
			left: 800,
			top: 319,
			'@media print': {
				display: 'none',
			},
		},
		playerPanelAnchor: {
			position: 'absolute',
			left: 1054,
			top: 319,
			'@media print': {
				display: 'none',
			},
		},
		partsPanelAnchor: {
			position: 'absolute',
			left: 800,
			top: 416,
			'@media print': {
				display: 'none',
			},
		},
		boomWhackerPanelAnchor: {
			position: 'absolute',
			left: 800,
			top: 515,
			'@media print': {
				display: 'none',
			},
		},
	}));
	const classes = useStyles();

	const [score, setScore] = useState<ScoreModel | null>(null);
	const selection = useRecoilValue(selectionAtom);
	const resetSelection = useResetRecoilState(selectionAtom);
	const resetCopiedMeasureId = useResetRecoilState(copiedMeasureIdAtom);
	const [diskSaveTime, setDiskSaveTime] = useRecoilState(diskSaveTimeAtom);
	const [musicHistory, setMusicHistory] = useState<MusicModel[]>([]);
	const [musicHistoryIdx, setMusicHistoryIdx] = useState(0);
	// todo add the first music to history when we mount
	useEffect(() => {
		if (!score) return;
		setMusicHistory((prev) => [...prev, JSON.parse(JSON.stringify(score))]);
		setMusicHistoryIdx(musicHistory.length - 1);
	}, [score, musicHistory.length, setMusicHistory]);

	const setSaveNotification = useCallback(function setSaveNotification(isActive: boolean) {
		const flashAnimationClassName = 'animate-flash';
		const saveBtnElm = document.getElementById('save-btn');
		if (saveBtnElm) {
			if (isActive) {
				setTimeout(() => {
					saveBtnElm.classList.add(flashAnimationClassName);
				}, 0);
			} else if (!isActive) {
				setTimeout(() => {
					saveBtnElm.classList.remove(flashAnimationClassName);
				}, 0);
			}
		}
	}, []);

	const handleScoreChanged = useCallback(
		function handleScoreChanged(changedScore: Score) {
			resetSelection();
			resetCopiedMeasureId();
			setMusicHistoryIdx(0);
			setMusicHistory([]);
			setScore(changedScore);
			setDiskSaveTime(new Date().getTime());
			setSaveNotification(false);
		},
		[resetSelection, resetCopiedMeasureId, setDiskSaveTime, setSaveNotification],
	);

	const handleScoreUpdated = useCallback(
		function handleScoreUpdated() {
			setScore((s) => {
				return { ...s } as ScoreModel;
			});
			const nowTime = new Date().getTime();
			const delayMilliseconds = 1000 * 60 * 5;
			// if we hadn't saved the score for more than 5 mins after last change, flash the save btn
			if (nowTime > diskSaveTime + delayMilliseconds) {
				setSaveNotification(true);
			}
		},
		[diskSaveTime, setSaveNotification],
	);

	const handleScoreSaved = useCallback(
		function handleScoreSaved() {
			setDiskSaveTime(new Date().getTime());
			setSaveNotification(false);
		},
		[setDiskSaveTime, setSaveNotification],
	);

	const handleScoreClosed = useCallback(
		function handleScoreClosed() {
			resetSelection();
			resetCopiedMeasureId();
			setMusicHistoryIdx(0);
			setMusicHistory([]);
			setScore(null);
			setDiskSaveTime(0);
			setSaveNotification(false);
		},
		[resetSelection, resetCopiedMeasureId, setDiskSaveTime, setSaveNotification],
	);

	const handleNote = useCallback(
		function handleNote(noteFullName: string, isBoomwhacker?: boolean) {
			if (!score || selection.length !== 1) {
				return;
			}
			const note = Score.findNote(score, selection[0].noteId);
			if (!note) {
				return;
			}
			// if it's the same note, don't do anything
			if (note.fullName === noteFullName && note.isBoomwhacker === isBoomwhacker) return;
			note.isRest = false;
			note.fullName = noteFullName;
			if (isBoomwhacker) note.isBoomwhacker = true;
			else {
				note.isBoomwhacker = false;
				const measure = Score.findMeasure(score, note.measureId);
				if (MusicalHelper.parseNote(noteFullName).alter === '#') {
					if (measure && !measure.useSharps) {
						note.fullName = MusicalHelper.toggleSharpAndFlat(note.fullName);
					}
				}
				// if note is tied  in front: change the tied note too
				if (note.isTiedToNext) Note.getTiedNote(note, score, true).fullName = noteFullName;
				// if note is tied from behind: sever the tie between them
				if (note.isTiedToPrev) {
					note.isTiedToPrev = false;
					Note.getTiedNote(note, score, false).isTiedToNext = false;
				}
			}
			handleScoreUpdated();
		},
		[score, selection, handleScoreUpdated],
	);

	const handleRedoUndo = useCallback(
		(val: number) => {
			debugger;
			if (musicHistoryIdx <= 0 || musicHistoryIdx >= musicHistory.length) return;
			setMusicHistoryIdx((prev) => (prev += val));
			// todo set score as musicHistory[musicHistoryIdx]
		},
		[musicHistory.length, musicHistoryIdx],
	);
	console.log('current history:', musicHistory);

	console.log('current score idx:', musicHistoryIdx);
	return (
		<Box id="ComposerPage" className={classes.root}>
			<Box className={classes.toolbarContainer}>
				<ComposerToolbar score={score} onChangeScore={handleScoreChanged} onSaveScore={handleScoreSaved} onCloseScore={handleScoreClosed} />
			</Box>
			{score && (
				<>
					<Box className={classes.stageContainer}>
						<StageUI score={score} onUpdateScore={handleScoreUpdated} onRedoUndo={handleRedoUndo} />
					</Box>
					<Box className={classes.pianoAnchor}>
						<Piano smallPiano={true} onPianoNote={handleNote} />
					</Box>
					<Box className={classes.notePanelAnchor}>
						<NotePanel score={score} onUpdateScore={handleScoreUpdated} />
					</Box>
					<Box className={classes.measurePanelAnchor}>
						<MeasurePanel score={score} onUpdateScore={handleScoreUpdated} />
					</Box>
					<Box className={classes.playerPanelAnchor}>
						<PlayerPanel music={score.music} />
					</Box>
					<Box className={classes.partsPanelAnchor}>
						<PartsPanel music={score.music} onUpdateScore={handleScoreUpdated} />
					</Box>
					<Box className={classes.boomWhackerPanelAnchor}>
						<BoomWhacker onBoomWhackerNote={handleNote} />
					</Box>
				</>
			)}
		</Box>
	);
};

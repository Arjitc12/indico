// This file is part of Indico.
// Copyright (C) 2002 - 2019 CERN
//
// Indico is free software; you can redistribute it and/or
// modify it under the terms of the MIT License; see the
// LICENSE file for more details.

import _ from 'lodash';
import {combineReducers} from 'redux';
import * as actions from './actions';

/**
 *
 * @param {Array} files - the array of files to look into
 * @param {String} uuid - the uuid of the file to look for
 * @param {Function} func - function used to "reduce" the file in question
 */
function replaceFile(files, uuid, func) {
  return files.map(file => (file.uuid === uuid ? func(file) : file)).filter(file => !!file);
}

/**
 * Reducer for arrays of files within a fileType (`fileType.files`).
 * @param {Array} state - the array of file objects which will be reduced
 * @param {Object} action - the action which will be processed
 * @param {boolean} allowMultipleFiles - whether the file type allows multiple files
 */
function fileListReducer(state, action, allowMultipleFiles) {
  switch (action.type) {
    case actions.MARK_UPLOADED: {
      const newFile = {...action.file, state: 'added'};
      return allowMultipleFiles ? [...state, newFile] : [newFile];
    }

    case actions.MARK_DELETED:
      return replaceFile(state, action.fileId, file =>
        file.claimed ? {...file, state: 'deleted'} : null
      );

    case actions.MARK_MODIFIED:
      return replaceFile(state, action.fileId, file =>
        file.claimed || file.state === 'modified'
          ? {
              ...action.file,
              state: 'modified',
              // if the current file is already a "replacement", then let's preserve
              // the "pointer" to the original file (we only allow undo to the initial file)
              originalFile: file.originalFile || file,
            }
          : null
      );

    case actions.UNDELETE:
      return replaceFile(state, action.fileId, file => ({...file, state: null}));

    case actions.REVERT:
      return replaceFile(state, action.fileId, file => ({
        ...file.originalFile,
        state: null,
      }));

    default:
      return state;
  }
}

export default combineReducers({
  fileTypes: (state = [], action) => {
    return state.map(fileType => {
      if (fileType.id === action.fileTypeId) {
        return {
          ...fileType,
          files: fileListReducer(fileType.files, action, fileType.allowMultipleFiles),
        };
      } else {
        return fileType;
      }
    });
  },
  uploads: (state = {}, action) => {
    switch (action.type) {
      case actions.PROGRESS: {
        const fileType = state[action.fileTypeId];
        const tmpFile = fileType[action.tmpFileId];
        return {
          ...state,
          [action.fileTypeId]: {
            ...fileType,
            [action.tmpFileId]: {...tmpFile, percent: action.percent},
          },
        };
      }

      case actions.START_UPLOADS: {
        const newUploads = _.mapValues(_.zipObject(action.tmpFileIds, action.files), file => ({
          progress: 0,
          file,
        }));
        return {...state, [action.fileTypeId]: {...state[action.fileTypeId], ...newUploads}};
      }

      case actions.MARK_MODIFIED:
      case actions.MARK_UPLOADED: {
        const fileType = state[action.fileTypeId];
        return {
          ...state,
          [action.fileTypeId]: _.omit(fileType, action.tmpFileId),
        };
      }

      default:
        return state;
    }
  },
  isDirty: (state = false, action) => {
    switch (action.type) {
      case actions.MARK_UPLOADED:
      case actions.MARK_MODIFIED:
      case actions.MARK_DELETED:
      case actions.UNDELETE:
      case actions.REVERT:
        return true;

      case actions.CLEAR_DIRTY:
        return false;

      default:
        return state;
    }
  },
});

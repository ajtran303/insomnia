// @flow
import { pluralize } from './misc';

export const strings = {
  workspace: 'Workspace',
  workspaces: 'Workspaces',
  document: 'Document',
  collection: 'Collection',
  home: 'Dashboard',
};

export const stringsPlural = {
  document: pluralize(strings.document),
  collection: pluralize(strings.collection),
};

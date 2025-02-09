import { describe, expect, it } from 'vitest';
import { reduceOutputs } from './outputs.js';

describe('reduceOutputs', () => {
  it('output with no data is removed', async () => {
    const mdast = {
      type: 'root',
      children: [
        {
          type: 'block',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  value: 'hi',
                },
              ],
            },
            {
              type: 'output',
              id: 'abc123',
              data: [],
            },
          ],
        },
      ],
    };
    expect(mdast.children[0].children.length).toEqual(2);
    reduceOutputs(mdast, 'notebook.ipynb', '/my/folder');
    expect(mdast.children[0].children.length).toEqual(1);
  });
  it('output with complex data is removed', async () => {
    const mdast = {
      type: 'root',
      children: [
        {
          type: 'block',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  value: 'hi',
                },
              ],
            },
            {
              type: 'output',
              id: 'abc123',
              data: [
                {
                  output_type: 'display_data',
                  execution_count: 3,
                  metadata: {},
                  data: {
                    'application/octet-stream': {
                      content_type: 'application/octet-stream',
                      hash: 'def456',
                      path: '/my/path/def456.png',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(mdast.children[0].children.length).toEqual(2);
    reduceOutputs(mdast, 'notebook.ipynb', '/my/folder');
    expect(mdast.children[0].children.length).toEqual(1);
  });
  it('image output converts to image node', async () => {
    const mdast = {
      type: 'root',
      children: [
        {
          type: 'output',
          id: 'abc123',
          data: [
            {
              output_type: 'display_data',
              execution_count: 3,
              metadata: {},
              data: {
                'image/png': {
                  content_type: 'image/png',
                  hash: 'def456',
                  path: '/my/path/def456.png',
                },
                'text/plain': {
                  content_type: 'text/plain',
                  hash: 'a6255a8d7ac11cabe5829e143599f112',
                  path: '/my/path/a6255a8d7ac11cabe5829e143599f112.txt',
                },
              },
            },
          ],
        },
      ],
    };
    reduceOutputs(mdast, 'notebook.ipynb', '/my/folder');
    expect(mdast.children.length).toEqual(1);
    expect(mdast.children[0].type).toEqual('image');
  });
  it('multiple outputs are maintained', async () => {
    const mdast = {
      type: 'root',
      children: [
        {
          type: 'output',
          id: 'abc123',
          data: [
            {
              output_type: 'display_data',
              execution_count: 3,
              metadata: {},
              data: {
                'image/png': {
                  content_type: 'image/png',
                  hash: 'def456',
                  path: '/my/path/def456.png',
                },
                'text/plain': {
                  content_type: 'text/plain',
                  hash: 'a6255a8d7ac11cabe5829e143599f112',
                  path: '/my/path/a6255a8d7ac11cabe5829e143599f112.txt',
                },
              },
            },
            {
              output_type: 'display_data',
              execution_count: 3,
              metadata: {},
              data: {
                'image/png': {
                  content_type: 'image/png',
                  hash: 'ghi789',
                  path: '/my/path/ghi789.png',
                },
                'text/plain': {
                  content_type: 'text/plain',
                  hash: 'a6255a8d7ac11cabe5829e143599f112',
                  path: '/my/path/a6255a8d7ac11cabe5829e143599f112.txt',
                },
              },
            },
          ],
        },
        {
          type: 'output',
          id: 'jkl012',
          data: [
            {
              output_type: 'display_data',
              execution_count: 3,
              metadata: {},
              data: {
                'image/png': {
                  content_type: 'image/png',
                  hash: 'mno345',
                  path: '/my/path/mno345.png',
                },
                'text/plain': {
                  content_type: 'text/plain',
                  hash: 'a6255a8d7ac11cabe5829e143599f112',
                  path: '/my/path/a6255a8d7ac11cabe5829e143599f112.txt',
                },
              },
            },
          ],
        },
      ],
    };
    reduceOutputs(mdast, 'notebook.ipynb', '/my/folder');
    expect(mdast.children.length).toEqual(3);
    expect(mdast.children[0].type).toEqual('image');
    expect(mdast.children[1].type).toEqual('image');
    expect(mdast.children[2].type).toEqual('image');
  });
});

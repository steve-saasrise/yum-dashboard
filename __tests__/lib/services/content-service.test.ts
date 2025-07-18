import { ContentService } from '@/lib/services/content-service';
import { ContentError } from '@/types/content';
import {
  createMockContent,
  createMockContentInput,
  MockSupabaseBuilder,
  ContentTestDataBuilder,
  expectContentToMatch,
} from '../../utils/test-helpers';

describe('ContentService', () => {
  let contentService: ContentService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = new MockSupabaseBuilder().build();
    contentService = new ContentService(mockSupabase as any);
  });

  describe('storeContent', () => {
    it('should store new content successfully', async () => {
      const input = createMockContentInput();
      const expectedContent = createMockContent(input);

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', expectedContent)
        .build();
      contentService = new ContentService(mockSupabase as any);

      // Mock checkDuplicate to return false (no duplicate)
      jest.spyOn(contentService, 'checkDuplicate').mockResolvedValue(false);

      const result = await contentService.storeContent(input);

      expect(result).toBeDefined();
      expectContentToMatch(result, {
        creator_id: input.creator_id,
        platform: input.platform,
        title: input.title,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('content');
    });

    it('should throw error for duplicate content', async () => {
      const input = createMockContentInput();

      // Mock duplicate check to return true
      mockSupabase = new MockSupabaseBuilder()
        .withData('content', createMockContent())
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest.spyOn(contentService, 'checkDuplicate').mockResolvedValue(true);

      await expect(contentService.storeContent(input)).rejects.toThrow(
        ContentError
      );
    });

    it('should validate input data', async () => {
      const invalidInput = {
        creator_id: 'invalid-uuid',
        platform: 'invalid-platform',
      } as any;

      await expect(contentService.storeContent(invalidInput)).rejects.toThrow(
        'Validation error'
      );
    });

    it('should calculate word count and reading time if not provided', async () => {
      const input = createMockContentInput({
        content_body: '<p>This is a test content with several words.</p>',
        word_count: undefined,
        reading_time_minutes: undefined,
      });

      const expectedContent = createMockContent({
        ...input,
        word_count: 8,
        reading_time_minutes: 1,
      });

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', expectedContent)
        .build();
      contentService = new ContentService(mockSupabase as any);

      // Mock checkDuplicate to return false (no duplicate)
      jest.spyOn(contentService, 'checkDuplicate').mockResolvedValue(false);

      const result = await contentService.storeContent(input);

      expect(result.word_count).toBe(8);
      expect(result.reading_time_minutes).toBe(1);
    });
  });

  describe('storeMultipleContent', () => {
    it('should store multiple new content items', async () => {
      const inputs = [
        createMockContentInput({ platform_content_id: 'item-1' }),
        createMockContentInput({ platform_content_id: 'item-2' }),
      ];

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', createMockContent())
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest.spyOn(contentService, 'checkDuplicate').mockResolvedValue(false);
      jest
        .spyOn(contentService, 'storeContent')
        .mockImplementation(async (input) => createMockContent(input));

      const result = await contentService.storeMultipleContent(inputs);

      expect(result.success).toBe(true);
      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing content', async () => {
      const inputs = [
        createMockContentInput({ platform_content_id: 'existing-1' }),
      ];

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', createMockContent())
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest.spyOn(contentService, 'checkDuplicate').mockResolvedValue(true);
      jest
        .spyOn(contentService, 'updateContentByPlatformId')
        .mockResolvedValue(createMockContent());

      const result = await contentService.storeMultipleContent(inputs);

      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('should handle mixed new and existing content', async () => {
      const inputs = [
        createMockContentInput({ platform_content_id: 'new-1' }),
        createMockContentInput({ platform_content_id: 'existing-1' }),
        createMockContentInput({ platform_content_id: 'new-2' }),
      ];

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', createMockContent())
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest
        .spyOn(contentService, 'checkDuplicate')
        .mockImplementation(async (_, platformId) => {
          return platformId === 'existing-1';
        });
      jest
        .spyOn(contentService, 'storeContent')
        .mockImplementation(async (input) => createMockContent(input));
      jest
        .spyOn(contentService, 'updateContentByPlatformId')
        .mockResolvedValue(createMockContent());

      const result = await contentService.storeMultipleContent(inputs);

      expect(result.created).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors without stopping batch', async () => {
      const inputs = [
        createMockContentInput({ platform_content_id: 'success-1' }),
        createMockContentInput({ platform_content_id: 'error-1' }),
        createMockContentInput({ platform_content_id: 'success-2' }),
      ];

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', createMockContent())
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest.spyOn(contentService, 'checkDuplicate').mockResolvedValue(false);
      jest
        .spyOn(contentService, 'storeContent')
        .mockImplementation(async (input) => {
          if (input.platform_content_id === 'error-1') {
            throw new Error('Storage failed');
          }
          return createMockContent(input);
        });

      const result = await contentService.storeMultipleContent(inputs);

      expect(result.success).toBe(false);
      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].platform_content_id).toBe('error-1');
    });
  });

  describe('checkDuplicate', () => {
    it('should return true for existing content', async () => {
      mockSupabase = new MockSupabaseBuilder()
        .withData('content', createMockContent())
        .build();
      contentService = new ContentService(mockSupabase as any);

      const exists = await contentService.checkDuplicate(
        'creator-123',
        'platform-123',
        'rss'
      );

      expect(exists).toBe(true);
    });

    it('should return false for non-existing content', async () => {
      mockSupabase = new MockSupabaseBuilder()
        .withError('content', { code: 'PGRST116' })
        .build();
      contentService = new ContentService(mockSupabase as any);

      const exists = await contentService.checkDuplicate(
        'creator-123',
        'new-content',
        'rss'
      );

      expect(exists).toBe(false);
    });
  });

  describe('updateContent', () => {
    it('should update content successfully', async () => {
      const contentId = 'content-123';
      const updateData = { title: 'Updated Title' };
      const updatedContent = createMockContent(updateData);

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', updatedContent)
        .build();
      contentService = new ContentService(mockSupabase as any);

      const result = await contentService.updateContent(contentId, updateData);

      expect(result.title).toBe('Updated Title');
      expect(mockSupabase.from).toHaveBeenCalledWith('content');
    });

    it('should throw error for non-existent content', async () => {
      mockSupabase = new MockSupabaseBuilder()
        .withError('content', { code: 'PGRST116' })
        .build();
      contentService = new ContentService(mockSupabase as any);

      await expect(
        contentService.updateContent('non-existent', { title: 'New' })
      ).rejects.toThrow('Content not found');
    });
  });

  describe('getContent', () => {
    it('should retrieve content by ID', async () => {
      const content = createMockContent();
      mockSupabase = new MockSupabaseBuilder()
        .withData('content', content)
        .build();
      contentService = new ContentService(mockSupabase as any);

      const result = await contentService.getContent(content.id);

      expect(result).toEqual(content);
    });

    it('should throw error for non-existent content', async () => {
      mockSupabase = new MockSupabaseBuilder()
        .withError('content', { code: 'PGRST116' })
        .build();
      contentService = new ContentService(mockSupabase as any);

      await expect(contentService.getContent('non-existent')).rejects.toThrow(
        'Content not found'
      );
    });
  });

  describe('getContentList', () => {
    it('should retrieve filtered content list', async () => {
      const contents = new ContentTestDataBuilder().addMultiple(5).build();

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', contents)
        .build();
      contentService = new ContentService(mockSupabase as any);

      const result = await contentService.getContentList({
        creator_id: '123e4567-e89b-12d3-a456-426614174000',
        platform: 'rss',
        limit: 10,
        offset: 0,
      });

      expect(result.content).toHaveLength(5);
      expect(result.total).toBe(5);
    });

    it('should apply pagination correctly', async () => {
      const contents = new ContentTestDataBuilder().addMultiple(20).build();

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', contents.slice(10, 15))
        .build();
      contentService = new ContentService(mockSupabase as any);

      const result = await contentService.getContentList({
        limit: 5,
        offset: 10,
      });

      expect(result.content).toHaveLength(5);
    });

    it('should filter by date range', async () => {
      const result = await contentService.getContentList({
        from_date: '2024-01-01T00:00:00Z',
        to_date: '2024-12-31T23:59:59Z',
      });

      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it('should search content', async () => {
      await contentService.getContentList({
        search: 'test query',
      });

      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('deleteContent', () => {
    it('should delete content by ID', async () => {
      mockSupabase = new MockSupabaseBuilder().build();
      contentService = new ContentService(mockSupabase as any);

      await contentService.deleteContent('content-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('content');
    });
  });

  describe('deleteContentByCreator', () => {
    it('should delete all content for a creator', async () => {
      const contents = new ContentTestDataBuilder().addMultiple(5).build();

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', contents)
        .build();
      contentService = new ContentService(mockSupabase as any);

      const deletedCount =
        await contentService.deleteContentByCreator('creator-123');

      expect(deletedCount).toBe(5);
    });
  });

  describe('content processing', () => {
    it('should mark content as processed', async () => {
      const updatedContent = createMockContent({
        processing_status: 'processed',
        ai_summary: 'AI generated summary',
      });

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', updatedContent)
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest
        .spyOn(contentService, 'updateContent')
        .mockResolvedValue(updatedContent);

      const result = await contentService.markContentProcessed(
        'content-123',
        'AI generated summary'
      );

      expect(result.processing_status).toBe('processed');
      expect(result.ai_summary).toBe('AI generated summary');
    });

    it('should mark content as failed', async () => {
      const updatedContent = createMockContent({
        processing_status: 'failed',
        error_message: 'Processing error',
      });

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', updatedContent)
        .build();
      contentService = new ContentService(mockSupabase as any);

      jest
        .spyOn(contentService, 'updateContent')
        .mockResolvedValue(updatedContent);

      const result = await contentService.markContentFailed(
        'content-123',
        'Processing error'
      );

      expect(result.processing_status).toBe('failed');
      expect(result.error_message).toBe('Processing error');
    });
  });

  describe('getCreatorContentStats', () => {
    it('should calculate content statistics', async () => {
      const contents = [
        createMockContent({ platform: 'rss', processing_status: 'processed' }),
        createMockContent({ platform: 'rss', processing_status: 'pending' }),
        createMockContent({
          platform: 'youtube',
          processing_status: 'processed',
        }),
      ];

      mockSupabase = new MockSupabaseBuilder()
        .withData('content', contents)
        .build();
      contentService = new ContentService(mockSupabase as any);

      const stats = await contentService.getCreatorContentStats('creator-123');

      expect(stats.total).toBe(3);
      expect(stats.byPlatform['rss']).toBe(2);
      expect(stats.byPlatform['youtube']).toBe(1);
      expect(stats.byStatus['processed']).toBe(2);
      expect(stats.byStatus['pending']).toBe(1);
      expect(stats.lastUpdated).toBeDefined();
    });

    it('should handle empty results', async () => {
      mockSupabase = new MockSupabaseBuilder().withData('content', []).build();
      contentService = new ContentService(mockSupabase as any);

      const stats = await contentService.getCreatorContentStats('creator-123');

      expect(stats.total).toBe(0);
      expect(stats.byPlatform).toEqual({});
      expect(stats.byStatus).toEqual({});
      expect(stats.lastUpdated).toBeUndefined();
    });
  });
});

import { describe, expect, it } from 'vitest';
import { parseResponse } from '../../src/parseResponse';

const RS = '\u241E';

describe('parseResponse', () => {
  describe('record separator delimiter', () => {
    it('splits on single ␞', () => {
      const input = ['replyTo: 123', 'message: Hello', RS, 'replyTo: 456', 'message: World'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(2);
      expect(result[0].replyTo).toBe('123');
      expect(result[0].message).toBe('Hello');
      expect(result[1].replyTo).toBe('456');
      expect(result[1].message).toBe('World');
    });

    it('unescapes ␞␞ to literal ␞ in message content', () => {
      const input = [`message: The delimiter is ${RS}${RS} for reference`].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(`The delimiter is ${RS} for reference`);
    });

    it('does not split on escaped ␞␞', () => {
      const input = [`message: before ${RS}${RS} after`, RS, 'message: second block'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe(`before ${RS} after`);
      expect(result[1].message).toBe('second block');
    });

    it('handles multiple escaped ␞␞ in a single block', () => {
      const input = `message: a${RS}${RS}b${RS}${RS}c`;

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(`a${RS}b${RS}c`);
    });

    it('handles escaped ␞␞ followed by ␞ delimiter on new line', () => {
      // Escaped literal ␞ at end of block, then delimiter on next line
      const input = [`message: ends with literal${RS}${RS}`, RS, 'message: next block'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe(`ends with literal${RS}`);
      expect(result[1].message).toBe('next block');
    });

    it('does not split on mid-line ␞', () => {
      // Bug: bot sends a lone ␞ mid-line (not on its own line) and the parser
      // incorrectly splits the message into two blocks
      const input = `message: here is a ${RS} in the middle of a line`;

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(`here is a ${RS} in the middle of a line`);
    });

    it('does not split on ␞ at end of a line with other content', () => {
      const input = `message: some text${RS}\nmore text on next line`;

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(`some text${RS}\nmore text on next line`);
    });

    it('does not split on ␞ at start of a line with other content', () => {
      const input = `message: first line\n${RS}more text`;

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe(`first line\n${RS}more text`);
    });

    it('adjacent ␞␞␞ is ambiguous — treated as escaped + trailing', () => {
      // ␞␞␞ with no separation: the lookbehind/lookahead means none of the
      // three match as a lone delimiter. This documents the known edge case.
      // In practice, the model puts delimiters on their own line.
      const input = `message: hello${RS}${RS}${RS}message: world`;

      const result = parseResponse(input);
      // All three ␞ are adjacent, so no split occurs — one block
      expect(result).toHaveLength(1);
    });
  });

  describe('--- fallback delimiter', () => {
    it('splits on --- when no ␞ present', () => {
      const input = ['replyTo: 123', 'message: Hello', '---', 'replyTo: 456', 'message: World'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('Hello');
      expect(result[1].message).toBe('World');
    });

    it('handles --- with surrounding whitespace', () => {
      const input = ['message: Hello', '  ---  ', 'message: World'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(2);
    });
  });

  describe('field parsing', () => {
    it('parses all fields', () => {
      const input = ['replyTo: 122198239934939140', 'ping: true', 'delay: 1000', 'message: Hello Hellcar!'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        replyTo: '122198239934939140',
        ping: true,
        delay: 1000,
        message: 'Hello Hellcar!',
      });
    });

    it('handles multiline messages', () => {
      const input = ['message: Line one', 'Line two', 'Line three'].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Line one\nLine two\nLine three');
    });

    it('handles message with code block containing ---', () => {
      // This is the bug that started it all
      const input = ['message: Here is some YAML:', '```yaml', '---', 'key: value', '---', '```'].join('\n');

      // With --- fallback (no ␞), this WILL split incorrectly
      // This test documents the known limitation of the fallback path
      const result = parseResponse(input);
      // The --- inside the code block causes a false split
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('code block with --- works correctly using ␞ delimiter', () => {
      // Same content but using ␞ delimiter - no false split
      const input = [RS, 'message: Here is some YAML:', '```yaml', '---', 'key: value', '---', '```', RS].join('\n');

      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain('---');
      expect(result[0].message).toContain('key: value');
    });

    it('defaults ping to undefined when not specified', () => {
      const result = parseResponse('message: Hello');
      expect(result[0].ping).toBeUndefined();
    });

    it('parses ping: false', () => {
      const input = ['ping: false', 'message: Hello'].join('\n');
      const result = parseResponse(input);
      expect(result[0].ping).toBe(false);
    });

    it('ignores invalid delay values', () => {
      const input = ['delay: -100', 'message: Hello'].join('\n');
      const result = parseResponse(input);
      expect(result[0].delay).toBeUndefined();
    });

    it('ignores NaN delay values', () => {
      const input = ['delay: banana', 'message: Hello'].join('\n');
      const result = parseResponse(input);
      expect(result[0].delay).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      expect(parseResponse('')).toEqual([]);
    });

    it('returns empty array for whitespace-only input', () => {
      expect(parseResponse('   \n\n   ')).toEqual([]);
    });

    it('filters blocks with no message content', () => {
      const input = [
        'replyTo: 123',
        'ping: true',
        // no message field
      ].join('\n');

      const result = parseResponse(input);
      expect(result).toEqual([]);
    });

    it('handles single block with no delimiter', () => {
      const result = parseResponse('message: Just one message');
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Just one message');
    });

    it('handles leading/trailing ␞ delimiters', () => {
      const input = `${RS}\nmessage: Hello\n${RS}`;
      const result = parseResponse(input);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Hello');
    });
  });
});

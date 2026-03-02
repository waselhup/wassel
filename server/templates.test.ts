import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';

describe('Message Templates', () => {
  it('should extract variables from template content', () => {
    const content = 'السلام عليكم {{name}}, شركتك {{company}} رائعة!';
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    expect(variables).toEqual(['name', 'company']);
  });

  it('should preview template with variable substitution', () => {
    const content = 'السلام عليكم {{name}}, شركتك {{company}} رائعة!';
    const variables = { name: 'محمد', company: 'شركة التقنية' };

    let preview = content;
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    });
    preview = preview.replace(/\{\{(\w+)\}\}/g, '[[$1]]');

    expect(preview).toBe('السلام عليكم محمد, شركتك شركة التقنية رائعة!');
  });

  it('should handle missing variables in preview', () => {
    const content = 'السلام عليكم {{name}}, شركتك {{company}} رائعة!';
    const variables = { name: 'محمد' }; // Missing company

    let preview = content;
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    });
    preview = preview.replace(/\{\{(\w+)\}\}/g, '[[$1]]');

    expect(preview).toBe('السلام عليكم محمد, شركتك [[company]] رائعة!');
  });

  it('should validate template structure', () => {
    const template = {
      name: 'قالب الترحيب',
      category: 'ترحيب',
      subject: 'أهلا وسهلا',
      content: 'السلام عليكم {{name}}',
      variables: ['name'],
    };

    expect(template.name).toBeTruthy();
    expect(template.content).toBeTruthy();
    expect(template.variables.length).toBeGreaterThan(0);
  });

  it('should handle template with no variables', () => {
    const content = 'شكراً لك على اهتمامك';
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    expect(variables).toEqual([]);
  });

  it('should handle duplicate variables', () => {
    const content = 'السلام عليكم {{name}}, {{name}} كيفك؟';
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    expect(variables).toEqual(['name']);
  });

  it('should handle special characters in variables', () => {
    const content = 'السلام عليكم {{first_name}}, {{last_name}}';
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    expect(variables).toEqual(['first_name', 'last_name']);
  });
});

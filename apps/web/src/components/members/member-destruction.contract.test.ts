import fs from 'fs';
import path from 'path';

describe('Destruction Member UI contract', () => {
  it('requires the exact phrase, member number, and explicit acknowledgement', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/members/MemberDestructionModal.tsx'),
      'utf8',
    );

    expect(source).toContain("phraseInput === 'DESTRUCTION MEMBER'");
    expect(source).toContain('memberNoInput === exactMemberNo');
    expect(source).toContain('understood &&');
    expect(source).toContain('Destruction diblokir');
    expect(source).toContain('deleteFinancialAndInventory: true');
    expect(source).toContain('jurnal, dan inventory akan dihapus permanen');

    const headerSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/members/MemberHeader.tsx'),
      'utf8',
    );
    expect(headerSource).toContain('isSuperAdmin && onDestroy');
  });
});

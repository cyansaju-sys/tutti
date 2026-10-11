import { describe, expect, it } from 'vitest'
import { languageFor, languageName } from '../../src/renderer/src/lib/languages'

describe('lenguajes del editor', () => {
  it('reconoce las extensiones adicionales', () => {
    for (const [file, name] of Object.entries({
      'main.rs': 'Rust', 'main.go': 'Go', 'Main.java': 'Java', 'main.cpp': 'C++', 'index.php': 'PHP',
      'deploy.sh': 'Shell', 'config.yaml': 'YAML', 'Cargo.toml': 'TOML'
    })) {
      expect(languageName(file)).toBe(name)
      expect(languageFor(file)).not.toEqual([])
    }
  })
})

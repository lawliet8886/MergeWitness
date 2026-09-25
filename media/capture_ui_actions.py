"""Capture a 96-second edit timeline from real MergeWitness browser states."""
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('MERGEWITNESS_CAPTURE_URL', 'http://127.0.0.1:5173/MergeWitness/')
OUT = Path(__file__).resolve().parent / '.ui-action-frames'
OUT.mkdir(parents=True, exist_ok=True)


def lerp(start, end, ratio):
    return start + (end - start) * ratio


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL, wait_until='networkidle')
    page.evaluate("document.documentElement.style.scrollBehavior = 'auto'")
    lab_top = page.locator('#laboratory').evaluate('(element) => element.offsetTop')
    evidence_top = page.locator('#evidence').evaluate('(element) => element.offsetTop')
    max_scroll = page.evaluate('document.documentElement.scrollHeight - innerHeight')
    evidence_view = min(evidence_top, max_scroll)
    actions = []

    def scroll_to(position):
        page.evaluate('(position) => window.scrollTo({top: Math.round(position), behavior: "instant"})', min(max(0, position), max_scroll))

    def capture(second, phase):
        path = OUT / f'frame_{second:03d}.png'
        page.screenshot(path=str(path), animations='disabled')
        actions.append({'second': second, 'phase': phase, 'file': path.name,
                        'scrollY': page.evaluate('Math.round(window.scrollY)')})

    # Establish the product and its branch diagram before pressing the CTA.
    for second in range(12):
        if second <= 3:
            scroll_to(0)
        elif second <= 8:
            scroll_to(lerp(0, 180, (second - 3) / 5))
        else:
            scroll_to(lerp(180, 0, (second - 8) / 3))
        capture(second, 'hero_and_branch_flow')

    page.get_by_role('button', name='Run comparison').click()
    page.get_by_role('status').get_by_text('Interaction witness found').wait_for(timeout=20000)
    assert '$90 to Beta; expected $100' in page.get_by_role('status').inner_text()
    scroll_to(lab_top)
    capture(12, 'run_comparison_result')

    # Four actual worker results, then move down to the concrete witness.
    for second in range(13, 28):
        scroll_to(lab_top + lerp(0, 55, (second - 13) / 14))
        capture(second, 'four_snapshot_matrix')
    for second in range(28, 44):
        scroll_to(lerp(lab_top + 55, evidence_view - 90, (second - 27) / 16))
        capture(second, 'matrix_to_alpha_beta_witness')
    for second in range(44, 56):
        scroll_to(lerp(evidence_view - 90, evidence_view, (second - 44) / 11))
        capture(second, 'alpha_beta_witness')

    page.get_by_role('tab', name='Bob session evidence').click()
    scroll_to(evidence_view)
    assert page.get_by_role('tabpanel', name='Bob session evidence').is_visible()
    for second in range(56, 65):
        scroll_to(evidence_view - 70 * math.sin(math.pi * (second - 56) / 8))
        capture(second, 'bob_session_evidence')

    page.get_by_role('tab', name='Verified Bob repair').click()
    scroll_to(evidence_view - 80)
    for second in range(65, 75):
        scroll_to(lerp(evidence_view - 80, evidence_view, (second - 65) / 9))
        capture(second, 'bob_repair_before_execution')

    page.get_by_role('button', name='Run verified candidate').click()
    page.get_by_role('button', name='Run candidate again').wait_for(timeout=20000)
    assert page.locator('.repair-action .pill.pass').is_visible()
    scroll_to(evidence_view)
    capture(75, 'run_verified_candidate')
    for second in range(76, 96):
        scroll_to(evidence_view - 120 * math.sin(math.pi * (second - 76) / 19))
        capture(second, 'candidate_pass_result')

    assert len(actions) == 96
    assert len(list(OUT.glob('frame_*.png'))) == 96
    assert not errors, errors
    manifest = {'source': URL, 'viewport': [1920, 1080], 'fps': 1,
                'duration_seconds': 96, 'frame_count': 96, 'browser_errors': errors,
                'actions': {'comparison': 12, 'bob_evidence': 56,
                            'select_repair': 65, 'run_candidate': 75},
                'frames': actions}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({key: manifest[key] for key in ['viewport', 'fps', 'duration_seconds', 'frame_count', 'browser_errors', 'actions']}))
    browser.close()

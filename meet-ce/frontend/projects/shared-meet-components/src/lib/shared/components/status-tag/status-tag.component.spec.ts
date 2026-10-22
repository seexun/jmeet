import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JmeetStatusTagComponent } from './status-tag.component';

describe('JmeetStatusTagComponent', () => {
	let fixture: ComponentFixture<JmeetStatusTagComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [JmeetStatusTagComponent]
		}).compileComponents();

		fixture = TestBed.createComponent(JmeetStatusTagComponent);
		fixture.componentRef.setInput('variant', 'success');
		fixture.componentRef.setInput('label', 'Active');
		fixture.detectChanges();
	});

	it('renders success variant with enterprise class', () => {
		const el = fixture.nativeElement.querySelector('.jmeet-status-tag');
		expect(el.classList).toContain('jmeet-status-tag--success');
		expect(el.textContent).toContain('Active');
	});
});

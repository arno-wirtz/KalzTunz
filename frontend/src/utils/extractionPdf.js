import { fmtDur } from './musicEngine.js'

export default async function exportExtractionPDF(result, file, instrument) {
  if (!window.jspdf) await new Promise((res,rej)=>{
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)
  })
  const {jsPDF}=window.jspdf
  const INSTRUMENTS=[{id:'all',label:'All'},{id:'piano',label:'Piano'},{id:'guitar',label:'Guitar'},{id:'bass',label:'Bass'},{id:'drums',label:'Drums'},{id:'strings',label:'Strings'},{id:'brass',label:'Brass'},{id:'vocals',label:'Vocals'},{id:'synth',label:'Synth'}]
  const {chords=[],metadata={},suggested_progressions=[]}=result
  const title=file?.name?.replace(/\.[^.]+$/,'')||'Extraction'
  const instrLabel=INSTRUMENTS.find(i=>i.id===instrument)?.label||'All'
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const W=210,M=14,IW=W-M*2;let y=0,page=1
  const CORAL=[255,107,71],AMBER=[255,179,71],DARK=[18,16,12],GREY=[90,82,72],LG=[160,155,148],LLG=[225,220,213]
  const ACCS=[[255,107,71],[255,179,71],[0,180,168],[232,84,42],[139,92,246],[52,211,153],[217,119,6],[232,54,93]]
  const np=()=>{doc.addPage();page++;y=16;doc.setFillColor(...CORAL);doc.rect(0,0,W,3,'F');doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...LG);doc.text(`KalzTunz · ${metadata.key||'?'} · ${metadata.bpm||'?'} BPM · ${instrLabel}`,M,9);doc.text(`Page ${page}`,W-M,9,{align:'right'});doc.setDrawColor(...LLG);doc.setLineWidth(0.2);doc.line(M,11,W-M,11)}
  const chk=(n=28)=>{if(y+n>282)np()}

  // Header
  doc.setFillColor(...CORAL);doc.rect(0,0,W,7,'F')
  doc.setFillColor(...AMBER);doc.rect(0,7,W,1.5,'F')
  y=22
  doc.setFont('times','bold');doc.setFontSize(22);doc.setTextColor(...DARK)
  doc.text(title,W/2,y,{align:'center',maxWidth:IW});y+=8
  doc.setFont('times','italic');doc.setFontSize(10);doc.setTextColor(...GREY)
  doc.text(`Key: ${metadata.key||'?'} · BPM: ${metadata.bpm||'?'} · Duration: ${fmtDur(metadata.duration||0)} · Filter: ${instrLabel}`,W/2,y,{align:'center'});y+=6
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...LG)
  doc.text(`${chords.length} chords · ${new Date().toLocaleDateString()}`,W/2,y,{align:'center'});y+=5
  doc.setDrawColor(...CORAL);doc.setLineWidth(0.8);doc.line(M,y,W-M,y);y+=6

  // Chord grid
  doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...CORAL)
  doc.text('CHORD TIMELINE',M,y);y+=4
  const COLS=8,cw=IW/COLS,ch=14
  chords.forEach((c,i)=>{
    if(i%COLS===0&&i>0)y+=ch+2
    if(i%COLS===0)chk(ch+3)
    const cx=i%COLS,x=M+cx*cw,ac=ACCS[i%ACCS.length]
    doc.setFillColor(252,250,246);doc.setDrawColor(...ac);doc.setLineWidth(0.28)
    doc.roundedRect(x,y,cw-1,ch,1.5,1.5,'FD')
    doc.setFillColor(...ac);doc.rect(x,y,cw-1,2,'F')
    doc.setFont('times','bold');doc.setFontSize(c.name.length>3?8:10);doc.setTextColor(...DARK)
    doc.text(c.name,x+cw/2,y+9,{align:'center'})
    doc.setFont('courier','normal');doc.setFontSize(5.5);doc.setTextColor(...LG)
    doc.text(`${c.time?.toFixed(1)}s`,x+cw/2,y+12.5,{align:'center'})
    const bx=x+1,by=y+ch-2,bw=cw-3
    doc.setFillColor(...LLG);doc.rect(bx,by,bw,1,'F')
    doc.setFillColor(...ac);doc.rect(bx,by,bw*(c.confidence||0),1,'F')
  })
  y+=ch+7

  // Progressions
  if(suggested_progressions.length){
    chk(18);doc.setDrawColor(...LLG);doc.setLineWidth(0.2);doc.line(M,y,W-M,y);y+=5
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...CORAL)
    doc.text('SUGGESTED PROGRESSIONS',M,y);y+=4
    suggested_progressions.forEach((p,i)=>{
      chk(16);const cl=p.split(' — '),cw2=IW/Math.max(cl.length,1),ac=ACCS[i%ACCS.length]
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...LG)
      doc.text(`Progression ${i+1}`,M,y);y+=3.5
      cl.forEach((ch2,ci)=>{
        const x2=M+ci*cw2
        doc.setFillColor(252,250,246);doc.setDrawColor(...ac);doc.setLineWidth(0.28)
        doc.roundedRect(x2,y,cw2-1,12,1.5,1.5,'FD')
        doc.setFillColor(...ac);doc.roundedRect(x2,y,cw2-1,2,0.8,0.8,'F')
        doc.setFont('times','bold');doc.setFontSize(ch2.length>3?8:10.5);doc.setTextColor(...DARK)
        doc.text(ch2,x2+cw2/2,y+9,{align:'center'})
      });y+=16
    })
  }

  // Footer
  for(let p=1;p<=page;p++){
    doc.setPage(p);doc.setFillColor(...CORAL);doc.rect(0,289,W,5,'F')
    doc.setFillColor(...AMBER);doc.rect(0,289,W,1.5,'F')
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(255,255,255)
    doc.text(`KalzTunz · Chord Extraction · ${title}`,M,292.5)
    doc.text(`${instrLabel} · ${metadata.key||''} · Page ${p} of ${page}`,W-M,292.5,{align:'right'})
  }
  doc.save(`${title.replace(/[^a-z0-9]/gi,'_')}_${instrLabel.replace(/\s/g,'_')}_sheet.pdf`)
}

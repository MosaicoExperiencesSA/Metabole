# -*- coding: utf-8 -*-
"""Guida per la nutrizionista: come creare le settimane che mancano."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable,
)

TEAL = colors.HexColor('#12a386')
DEEP = colors.HexColor('#10403a')
INK = colors.HexColor('#2E3E3B')
MUTED = colors.HexColor('#5F6E6B')
LINE = colors.HexColor('#DCE5E2')
CHIP = colors.HexColor('#EEF3F1')
WARN_BG = colors.HexColor('#FDF6E8')
WARN_LINE = colors.HexColor('#F0DFBA')
WARN_INK = colors.HexColor('#6B4E12')

PAG = A4
MARG = 20 * mm

def stile(nome, **kw):
    base = dict(fontName='Helvetica', fontSize=10.5, leading=15.5, textColor=INK,
                alignment=TA_LEFT, spaceAfter=0)
    base.update(kw)
    return ParagraphStyle(nome, **base)

S = {
    'titolo': stile('titolo', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=DEEP),
    'sotto': stile('sotto', fontSize=11.5, leading=17, textColor=MUTED),
    'h2': stile('h2', fontName='Helvetica-Bold', fontSize=14.5, leading=19, textColor=DEEP),
    'h3': stile('h3', fontName='Helvetica-Bold', fontSize=11.5, leading=16, textColor=DEEP),
    'p': stile('p'),
    'small': stile('small', fontSize=9.5, leading=14, textColor=MUTED),
    'passo_n': stile('passo_n', fontName='Helvetica-Bold', fontSize=15, leading=17,
                     textColor=colors.white, alignment=1),
    'passo_t': stile('passo_t', fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=DEEP),
    'warn': stile('warn', fontSize=10.5, leading=15.5, textColor=WARN_INK),
    'warn_t': stile('warn_t', fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=WARN_INK),
    'th': stile('th', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.white),
    'td': stile('td', fontSize=9.5, leading=13.5),
    'td_b': stile('td_b', fontName='Helvetica-Bold', fontSize=9.5, leading=13.5),
}


def testata_e_piede(canvas, doc):
    canvas.saveState()
    w, h = PAG
    # Filo colorato in testa
    canvas.setFillColor(TEAL)
    canvas.rect(0, h - 6 * mm, w, 6 * mm, stroke=0, fill=1)
    # Piede
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARG, 12 * mm, 'Metabole - Come completare le settimane di menu')
    canvas.drawRightString(w - MARG, 12 * mm, 'pagina %d' % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(MARG, 16 * mm, w - MARG, 16 * mm)
    canvas.restoreState()


def passo(n, titolo, corpo, nota=None):
    """Un passo numerato: pallino col numero + testo."""
    dentro = [Paragraph(titolo, S['passo_t']), Spacer(1, 3)]
    for c in corpo:
        dentro.append(Paragraph(c, S['p']))
        dentro.append(Spacer(1, 3))
    if nota:
        dentro.append(Spacer(1, 2))
        dentro.append(Paragraph(nota, S['small']))
    pallino = Table([[Paragraph(str(n), S['passo_n'])]], colWidths=[9 * mm], rowHeights=[9 * mm])
    pallino.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), TEAL),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('ROUNDEDCORNERS', [4.5 * mm, 4.5 * mm, 4.5 * mm, 4.5 * mm]),
    ]))
    t = Table([[pallino, dentro]], colWidths=[14 * mm, None])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 5 * mm),
        ('RIGHTPADDING', (1, 0), (1, 0), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([t, Spacer(1, 9)])


def riquadro(titolo, righe, sfondo=WARN_BG, bordo=WARN_LINE, stile_t='warn_t', stile_p='warn'):
    dentro = []
    if titolo:
        dentro.append(Paragraph(titolo, S[stile_t]))
        dentro.append(Spacer(1, 4))
    for i, r in enumerate(righe):
        dentro.append(Paragraph(r, S[stile_p]))
        if i < len(righe) - 1:
            dentro.append(Spacer(1, 4))
    t = Table([[dentro]], colWidths=[None])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), sfondo),
        ('BOX', (0, 0), (-1, -1), 0.8, bordo),
        ('LEFTPADDING', (0, 0), (-1, -1), 5 * mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5 * mm),
        ('TOPPADDING', (0, 0), (-1, -1), 4 * mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4 * mm),
        ('ROUNDEDCORNERS', [3 * mm, 3 * mm, 3 * mm, 3 * mm]),
    ]))
    return KeepTogether([t, Spacer(1, 8)])


def tabella(intestazioni, righe, larghezze):
    dati = [[Paragraph(h, S['th']) for h in intestazioni]]
    for r in righe:
        dati.append([Paragraph(c, S['td_b'] if i == 0 else S['td']) for i, c in enumerate(r)])
    t = Table(dati, colWidths=larghezze, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DEEP),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, DEEP),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, CHIP]),
        ('LEFTPADDING', (0, 0), (-1, -1), 3 * mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3 * mm),
        ('TOPPADDING', (0, 0), (-1, -1), 2.6 * mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.6 * mm),
    ]))
    return t


def build(percorso):
    doc = BaseDocTemplate(percorso, pagesize=PAG,
                          leftMargin=MARG, rightMargin=MARG,
                          topMargin=18 * mm, bottomMargin=22 * mm,
                          title='Come completare le settimane di menu',
                          author='Metabole')
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id='corpo',
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id='std', frames=[frame], onPage=testata_e_piede)])

    F = []
    A = F.append

    # ---------------- Copertina / apertura ----------------
    A(Paragraph('Come completare le settimane di menu', S['titolo']))
    A(Spacer(1, 4))
    A(Paragraph('Guida passo per passo per la nutrizionista &#8212; aggiornata al 8 agosto 2026', S['sotto']))
    A(Spacer(1, 7))
    A(HRFlowable(width='100%', thickness=1, color=LINE, spaceAfter=10))

    A(Paragraph('Perché i menu si ripetono', S['h2']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Una cliente ci ha segnalato di aver ricevuto <b>lo stesso pranzo per quattro giorni di fila</b>. '
        'Abbiamo controllato, e non era un caso isolato: era il modo in cui il catalogo veniva creato.', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Quando si generava una dieta, il sistema chiedeva <i>&#171;per quanti giorni?&#187;</i> e tu rispondevi 28. '
        'Sembrava di ottenere 28 colazioni, 28 pranzi, 28 cene e 28 merende diverse. In realtà il sistema '
        'creava <b>solo 5 piatti per ogni pasto</b> e poi li mescolava per riempire 28 giornate. '
        'Con 5 colazioni distribuite su 28 giorni, ogni colazione torna cinque o sei volte al mese. '
        'Non era sfortuna: era matematica.', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Se apri le ricette della Keto Mediterranea trovi 28 ricette <i>in tutto</i>, non 28 per ogni pasto. '
        'Ecco da dove nasceva la ripetizione.', S['p']))
    A(Spacer(1, 9))

    A(Paragraph('Che cosa è cambiato', S['h2']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Adesso il catalogo si costruisce <b>una settimana per volta</b>. Ogni settimana sono 7 giornate '
        'con <b>7 piatti nuovi per ogni pasto</b>: sette colazioni diverse, sette pranzi diversi, sette cene '
        'diverse. Il giorno 1 prende il primo piatto di ogni pasto, il giorno 2 il secondo, e così via. '
        'Dentro la settimana non si può ripetere niente, perché non ci sono doppioni da cui pescare.', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Quattro settimane fanno un mese completo: <b>28 giorni senza mai lo stesso piatto</b>. '
        'Quando generi la seconda settimana, il sistema ricorda i piatti della prima e non li ripropone.', S['p']))
    A(Spacer(1, 8))
    A(riquadro('In pratica, per te', [
        'Nella pagina <b>Creazione e validazione</b>, al passo 2, il campo dove scrivevi &#171;28 giorni&#187; '
        'non c\'è più. Al suo posto trovi dei pulsanti: <b>Settimana 1, Settimana 2, Settimana 3</b>... '
        'Ne fai una alla volta.',
        'Le diete già create restano come sono finché non le completi: è il lavoro descritto in questa guida.',
    ], sfondo=CHIP, bordo=LINE, stile_t='h3', stile_p='p'))

    # ---------------- La regola d'oro ----------------
    A(Spacer(1, 2))
    A(Paragraph('La regola d\'oro: parti sempre dai 5 pasti', S['h2']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Ogni dieta esiste in più <b>varianti</b>: a 3 pasti, a 5 pasti, a digiuno intermittente. '
        'I piatti però sono gli stessi: la Keto Mediterranea onnivora a 3 pasti e quella a 5 pasti mangiano '
        'le stesse cose, cambia solo come sono distribuite nella giornata. I piatti cambiano davvero solo quando '
        'cambia il <b>regime</b> (vegetariano, vegano) o lo <b>stile</b> (keto invece di mediterranea).', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Per questo il sistema le fa condividere. Se generi <b>prima la variante a 5 pasti</b>, quella a 3 pasti '
        'e quella a digiuno <b>riusano le sue ricette</b>: non devi generarle di nuovo, e le tre varianti restano '
        'coerenti fra loro. Se parti da quella a 3 pasti, invece, mancheranno gli spuntini e dovrai generarli a parte.', S['p']))
    A(Spacer(1, 8))
    A(riquadro('Ricordati solo questo', [
        '<b>Prima i 5 pasti. Poi le altre.</b> Il resto lo fa il sistema.',
    ]))

    # ---------------- Passo per passo ----------------
    A(KeepTogether([
        Paragraph('Le ricette che hai già corretto non si perdono', S['h2']),
        Spacer(1, 5),
        Paragraph(
            'Questa è la domanda giusta da farsi, e la risposta è no: <b>non si butta via niente</b>. '
            'Le ricette che hai sistemato a mano restano dove sono.', S['p']),
    ]))
    A(Spacer(1, 5))
    A(Paragraph(
        'Quando clicchi su una settimana che esiste già, il sistema non la rifà da capo: la '
        '<b>completa</b>. Guarda quanti piatti ci sono già per ogni pasto, li tiene, e chiede all\'AI '
        '<b>solo quelli che mancano</b> per arrivare a sette. Poi riscrive le sette giornate in modo che '
        'nessun piatto torni due volte.', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Un esempio concreto. La Keto Mediterranea ha oggi <b>5 pranzi</b> spalmati su 28 giorni. '
        'Quando fai la settimana 1, quei 5 pranzi diventano i pranzi dei primi cinque giorni e il sistema '
        'ne scrive <b>2 nuovi</b> per il sesto e il settimo. Alla settimana 2 i vecchi sono finiti, quindi '
        'ne scrive 7 nuovi. E così via. Alla fine hai 28 pranzi diversi, e i tuoi 5 corretti sono ancora lì.', S['p']))
    A(Spacer(1, 8))
    A(riquadro('L\'unico modo per perdere del lavoro', [
        'Nella pagina, sotto i pulsanti delle settimane, compare una spunta <b>&#171;Rifai da capo&#187;</b>. '
        'Quella <b>cancella</b> le ricette bozza di quella settimana, comprese le tue correzioni.',
        'Lasciala sempre spenta, tranne quando i piatti di una settimana non ti convincono proprio e '
        'preferisci ripartire da zero. Il sistema in quel caso ti chiede conferma una seconda volta.',
    ]))

    A(Paragraph('Come si fa, passo per passo', S['h2']))
    A(Spacer(1, 3))
    A(Paragraph('Da fare per ogni dieta della lista che trovi più avanti.', S['small']))
    A(Spacer(1, 9))

    A(passo(1, 'Apri la pagina giusta', [
        'Nel backoffice, dal menu di sinistra, scegli <b>Creazione e validazione</b>.',
    ]))
    A(passo(2, 'Scegli la dieta e la variante a 5 pasti', [
        'Al <b>passo 1 &#8212; Scegli la dieta</b> seleziona la dieta su cui vuoi lavorare (per esempio Keto Mediterranea).',
        'Fra le varianti scegli quella con <b>5 pasti</b>. La riconosci dall\'etichetta: '
        '&#171;onnivoro &#183; dimagrimento &#183; 5 pasti&#187;.',
    ], nota='Se questa dieta ha più regimi (onnivoro, vegetariano, vegano) sono diete diverse: '
            'vanno fatte una per una, ognuna coi suoi piatti.'))
    A(passo(3, 'Guarda a che punto sei', [
        'Scendi al <b>passo 2 &#8212; Genera il catalogo</b>. Vedi la riga <b>&#171;Settimana da generare&#187;</b> con i pulsanti '
        'Settimana 1, 2, 3...',
        'Le settimane già presenti hanno una <b>spunta</b>. Quella che il sistema ti propone è già '
        'selezionata in verde.',
    ]))
    A(passo(4, 'Genera la settimana', [
        'Clicca il pulsante <b>&#171;Genera la settimana 1&#187;</b> (o il numero che stai facendo) e aspetta. '
        'Ci vuole <b>fino a un minuto</b>: è normale, sta scrivendo trentacinque ricette.',
        'Non chiudere la pagina e non cliccare due volte. Quando ha finito compare un messaggio verde che dice '
        'quante giornate ha creato.',
    ], nota='Se la settimana esiste già, il sistema la <b>completa</b>: tiene le ricette che ci sono '
            'e aggiunge solo quelle che mancano. Non devi fare niente di diverso.'))
    A(passo(5, 'Ripeti fino alla settimana 4', [
        'Dopo ogni generazione il pulsante si sposta da solo sulla settimana successiva. '
        'Rifai il passo 4 per la settimana 2, poi la 3, poi la 4.',
        'Quattro settimane = un mese di menu senza ripetizioni. Puoi anche andare oltre, ma quattro bastano.',
    ], nota='Non puoi saltare avanti (per esempio dalla 1 alla 3): resterebbe un buco di sette giorni '
            'in mezzo al ciclo, e il sistema non saprebbe cosa dare alle clienti in quei giorni.'))
    A(passo(6, 'Fai le altre varianti della stessa dieta', [
        'Torna al passo 1 e scegli la variante a <b>3 pasti</b>, poi quella a <b>digiuno intermittente</b>. '
        'Per ognuna rifai le settimane da 1 a 4.',
        'Sarà molto più veloce: prendono i piatti già scritti per i 5 pasti. Nel messaggio finale te lo dice '
        '(<i>&#171;ricette riprese dalle varianti sorelle&#187;</i>).',
    ]))
    A(passo(7, 'Controlla e pubblica', [
        'Scendi al <b>passo 3 &#8212; Valida e pubblica</b>. Usa <b>&#171;Anteprima giornate&#187;</b> per scorrere i giorni '
        'e vedere che i piatti siano diversi e sensati.',
        'Poi completa le spunte: <b>Ricette</b> (attiva tutte), <b>Allergeni</b> (approva tutti, dopo averli guardati), '
        '<b>Gruppi di equivalenza</b>. Se la dieta ha più varianti puoi usare il pulsante '
        '<b>&#171;Valida e pubblica tutte le varianti&#187;</b>.',
    ], nota='Gli allergeni sono l\'unico passo che non va mai fatto in automatico senza guardare: '
            'è sicurezza, non gusto.'))

    A(Spacer(1, 4))
    A(riquadro('Le clienti che stanno mangiando adesso', [
        'Puoi lavorare tranquilla: <b>i menu già consegnati non cambiano</b>. Sono una fotografia, restano '
        'come sono anche mentre tu completi il catalogo. Le ricette nuove entrano nei menu <b>dei giorni successivi</b>.',
        'E nessuna ricetta già in uso viene cancellata: il sistema tocca solo le bozze.',
    ]))

    # ---------------- Da quali iniziare ----------------
    A(Paragraph('Da quali diete iniziare', S['h2']))
    A(Spacer(1, 5))
    A(Paragraph(
        'In catalogo ci sono <b>287 varianti di dieta</b> e quasi tutte hanno il difetto dei cinque '
        'piatti per pasto. Rifarle tutte a mano non è un lavoro da fare, e soprattutto non serve: '
        '<b>solo 16 hanno una cliente sopra in questo momento</b>, e sono 25 clienti in tutto. '
        'Quelle sedici sono le uniche in cui la ripetizione la sta vedendo qualcuno.', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'E siccome le varianti della stessa dieta si passano i piatti, le sedici si riducono a '
        '<b>dodici diete</b>. Questa è la lista, nell\'ordine in cui conviene farle.', S['p']))
    A(Spacer(1, 8))

    A(KeepTogether(tabella(
        ['', 'Dieta e regime', 'Clienti', 'Che cosa fare'],
        [
            ['1', '<b>Flexitariana</b> &#183; onnivora &#183; dimagrimento', '10',
             'Settimane 1-4 sulla variante a <b>5 pasti</b>. Poi apri quella a <b>3 pasti</b> e quella a '
             '<b>digiuno</b>: prendono i piatti da sola.'],
            ['2', '<b>Pescetariana</b> &#183; onnivora &#183; dimagrimento', '3',
             'Settimane 1-4 sui <b>5 pasti</b>, poi la variante a 3 pasti.'],
            ['3', '<b>Keto (non terapeutica)</b> &#183; onnivora &#183; dimagrimento', '3',
             'Settimane 1-4 sui <b>5 pasti</b>, poi il digiuno.'],
            ['4', '<b>Vacanze in Serenità</b> &#183; onnivora &#183; dimagrimento', '1',
             '<b>Da guardare per prima:</b> le mancano interi pasti, non solo varietà. Vedi il '
             'riquadro qui sotto.'],
            ['5', '<b>Iperproteica sportiva</b> &#183; onnivora &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti.'],
            ['6', '<b>DASH</b> &#183; onnivora &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti.'],
            ['7', '<b>Low carb</b> &#183; onnivora &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti.'],
            ['8', '<b>Basso indice glicemico</b> &#183; onnivora &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti, poi i 3 pasti.'],
            ['9', '<b>Proteica</b> &#183; onnivora &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti, poi i 3 pasti.'],
            ['10', '<b>Pescetariana</b> &#183; vegetariana &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti, poi i 3 pasti.'],
            ['11', '<b>Vegana</b> &#183; vegana &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti, poi i 3 pasti.'],
            ['12', '<b>Keto-Mediterranea</b> &#183; onnivora &#183; dimagrimento', '1', 'Settimane 1-4 sui 5 pasti, poi il digiuno.'],
        ],
        [11 * mm, 58 * mm, 17 * mm, None])))
    A(Spacer(1, 9))
    A(Paragraph(
        'Sono tutte con obiettivo <b>dimagrimento</b>: le versioni "mantenimento" delle stesse diete '
        'oggi non le riceve nessuno.', S['small']))
    A(Spacer(1, 9))

    A(riquadro('Attenzione &#8212; una dieta da guardare subito: Vacanze in Serenità (3 pasti)', [
        'Questa non è magra, è <b>rotta</b>: ha solo le colazioni. Pranzo e cena <b>non ci sono</b>, '
        'e c\'è una cliente che la sta ricevendo.',
        'Fai le settimane 1-4 su questa per prima, e quando hai finito usa <b>Anteprima giornate</b> per '
        'controllare che ogni giorno abbia davvero colazione, pranzo e cena.',
    ]))

    A(Paragraph('Quanto lavoro è, davvero', S['h2']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Dodici diete &#215; quattro settimane sulla variante a 5 pasti = <b>48 generazioni</b>, circa un '
        'minuto l\'una. Le varianti a 3 pasti e a digiuno sono quasi istantanee perché riusano i piatti. '
        'In tutto: <b>meno di un\'ora</b> di attesa, che puoi spezzare come vuoi &#8212; la pagina si ricorda '
        'sempre a che punto sei.', S['p']))
    A(Spacer(1, 5))
    A(Paragraph(
        'Le altre 270 varianti non hanno nessuno sopra. <b>Non sono lavoro tuo da fare a mano</b>: '
        'se ne occupa Simone, oppure si rigenerano quando servono davvero, cioè quando una cliente '
        'sceglie quella dieta. Se dovessi aprirne una che risulta magra, completala sul momento con lo '
        'stesso metodo.', S['p']))
    A(Spacer(1, 10))

    # ---------------- Domande ----------------
    testa_domande = [Paragraph('Domande che ti verranno', S['h2']), Spacer(1, 8)]

    domande = [
        ('Quanto ci mette?',
         'Circa un minuto a settimana per la variante a 5 pasti. Le altre due varianti sono quasi immediate, '
         'perché riusano i piatti già scritti. Quindi una dieta completa (4 settimane, 3 varianti) '
         'sono circa <b>cinque minuti</b>.'),
        ('Posso fermarmi a metà e riprendere domani?',
         'Sì. Ogni settimana è salvata appena finisce. Quando torni, la pagina ti mostra le spunte su quelle '
         'già fatte e ti propone la prossima. Non devi ricordarti niente.'),
        ('Ho generato una settimana e non mi piace. Posso rifarla?',
         'Sì. Riclicca quel numero di settimana, metti la spunta <b>&#171;Rifai da capo&#187;</b> e conferma. '
         'Attenzione: quella è l\'unica azione che cancella le ricette bozza di quella settimana, '
         'correzioni comprese. Le altre settimane non si toccano.'),
        ('Se ricclicco una settimana già fatta, cosa succede?',
         'Senza la spunta &#171;Rifai da capo&#187;, la <b>completa</b>: tiene tutto quello che c\'è e aggiunge '
         'solo i piatti mancanti. È l\'operazione da usare sulle diete vecchie, ed è sicura.'),
        ('Perché non posso saltare alla settimana 3?',
         'Perché il ciclo dei menu scorre giorno per giorno. Se ci fossero la settimana 1 e la 3 ma non la 2, '
         'dal giorno 8 al 14 non ci sarebbe niente da dare.'),
        ('E se il sistema non riesce a scrivere un pasto?',
         'Te lo dice, con un avviso arancione che nomina il pasto (per esempio &#171;merenda&#187;). '
         'In quel caso rigenera quella settimana: quasi sempre al secondo tentativo va.'),
        ('I piatti sono definitivi?',
         'No. Escono come <b>bozza</b>: nessuna cliente li riceve finché non li attivi tu al passo 3. '
         'Puoi correggerli, sostituirli o cancellarli dalla pagina Ricette prima di pubblicare.'),
        ('E gli allergeni?',
         'Il sistema li propone leggendo gli ingredienti, ma <b>li devi confermare tu</b>. Nessun piatto entra '
         'nei menu con gli allergeni non confermati.'),
    ]
    for i, (d, r) in enumerate(domande):
        blocco = [
            Paragraph(d, S['h3']),
            Spacer(1, 2),
            Paragraph(r, S['p']),
            Spacer(1, 8),
        ]
        # Il titolo di sezione non deve restare da solo in fondo a una pagina: sta insieme
        # alla prima domanda.
        A(KeepTogether((testa_domande + blocco) if i == 0 else blocco))

    # ---------------- Promemoria ----------------
    A(Spacer(1, 2))
    A(HRFlowable(width='100%', thickness=1, color=LINE, spaceAfter=10))
    A(Paragraph('Il promemoria, in cinque righe', S['h2']))
    A(Spacer(1, 7))
    A(KeepTogether(tabella(
        ['', 'Cosa fare'],
        [
            ['1', 'Vai su <b>Creazione e validazione</b> e scegli la dieta, <b>variante a 5 pasti</b>.'],
            ['2', 'Al passo 2 clicca <b>Genera la settimana 1</b>, aspetta il messaggio verde.'],
            ['3', 'Ripeti per le settimane <b>2, 3, 4</b>. Se una esiste già, viene <b>completata</b>: le tue correzioni restano.'],
            ['4', 'Rifai lo stesso per la variante a <b>3 pasti</b> e per il <b>digiuno</b> (saranno velocissime).'],
            ['5', 'Al passo 3: anteprima, allergeni confermati, poi <b>pubblica</b>.'],
        ],
        [10 * mm, None])))
    A(Spacer(1, 10))
    A(Paragraph(
        'Se qualcosa non torna o un messaggio non è chiaro, scrivilo a Simone senza fare tentativi al buio: '
        'è più veloce sistemarlo che rimediare dopo.', S['small']))

    doc.build(F)
    print('fatto:', percorso)


if __name__ == '__main__':
    build('/tmp/guida/Metabole-Come-creare-le-settimane-di-menu.pdf')

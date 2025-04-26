// Rota para excluir a novidade
app.delete('/delete-novidade/:id', async (req, res) => {
    const { id } = req.params; // Obtém o ID da novidade da URL

    try {
        // Deleta a novidade com o ID fornecido
        const result = await client.query(
            'DELETE FROM novidades WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rowCount > 0) {
            // Se a novidade foi deletada com sucesso
            res.status(200).json({
                success: true,
                message: 'Novidade excluída com sucesso!',
            });
        } else {
            // Se não foi encontrada a novidade com o ID fornecido
            res.status(404).json({
                success: false,
                message: 'Novidade não encontrada.',
            });
        }
    } catch (err) {
        console.error('Erro ao excluir novidade:', err);
        res.status(500).json({ error: 'Erro ao excluir a novidade' });
    }
});
